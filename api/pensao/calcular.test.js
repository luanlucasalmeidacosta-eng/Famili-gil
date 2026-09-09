import { describe, it, expect, vi } from 'vitest'
import { processarCalculo } from './calcular.js'

// fake supabase: cada from(tabela) devolve um builder que resolve com dados fixos
function fakeSb(tabelas) {
  return {
    from(t) {
      const cfg = tabelas[t] || { data: null, error: null }
      const b = {
        _single: false,
        select() { return b },
        eq() { return b },
        order() { return b },
        limit() { return b },
        maybeSingle() { b._single = true; return Promise.resolve(cfg) },
        single() { b._single = true; return Promise.resolve(cfg) },
        then(res) { return Promise.resolve(cfg).then(res) },
        insert(row) { tabelas.__inserted__ = row; return { select() { return { single() { return Promise.resolve({ data: { id: 'mem1' }, error: null }) } } } } },
      }
      return b
    },
  }
}

const paramsOk = {
  caso_id: 'c1', tipo_valor: 'fixo', valor_base: 1000, dia_vencimento: 10,
  data_inicial: '2024-09-01', data_final: '2024-09-30', indice_correcao: 'legal',
  regra_imputacao: 'mais_antigas_primeiro', regime_juros_convencionado: '1_am_simples',
}
const parcelasOk = [{ id: 'p1', competencia: '2024-09-01', vencimento: '2024-09-10', valor_devido: 1000, ativa: true }]

function baseTabelas(over = {}) {
  return {
    casos: { data: { id: 'c1', data_citacao: null, titulo: 'X' }, error: null },
    pensao_parametros: { data: paramsOk, error: null },
    pensao_parcelas: { data: parcelasOk, error: null },
    pensao_pagamentos: { data: [], error: null },
    pensao_memoria: { data: null, error: null }, // max(versao) -> null
    ...over,
  }
}

const seriesFull = {
  SELIC_DIARIA: Object.fromEntries(
    Array.from({ length: 40 }, (_, i) => {
      const d = new Date(Date.UTC(2024, 8, 1 + i)).toISOString().slice(0, 10)
      return [d, 0.04]
    }),
  ),
  IPCA: { '2024-09-01': 0.5, '2024-10-01': 0.5 },
}

describe('processarCalculo', () => {
  it('caminho feliz → grava versão 1 e responde memoriaId', async () => {
    const tabelas = baseTabelas()
    const out = await processarCalculo({
      supabase: fakeSb(tabelas), casoId: 'c1', dataBase: '2024-09-30',
      resolver: async () => seriesFull, cachePort: {}, fetchImpl: () => {},
    })
    expect(out).toEqual({ memoriaId: 'mem1', versao: 1 })
  })

  it('sem parâmetros → 422', async () => {
    const tabelas = baseTabelas({ pensao_parametros: { data: null, error: null } })
    await expect(processarCalculo({
      supabase: fakeSb(tabelas), casoId: 'c1', dataBase: '2024-09-30',
      resolver: async () => seriesFull, cachePort: {}, fetchImpl: () => {},
    })).rejects.toMatchObject({ status: 422 })
  })

  it('índice mensal faltando uma competência → 503', async () => {
    const tabelas = baseTabelas()
    await expect(processarCalculo({
      supabase: fakeSb(tabelas), casoId: 'c1', dataBase: '2024-11-30',
      resolver: async () => ({ ...seriesFull, IPCA: { '2024-09-01': 0.5, '2024-11-01': 0.5 } }), // falta 2024-10
      cachePort: {}, fetchImpl: () => {},
    })).rejects.toMatchObject({ status: 503 })
  })

  it('data-base além da última competência fechada → 422', async () => {
    const tabelas = baseTabelas()
    const selicExtended = Object.fromEntries(
      Array.from({ length: 92 }, (_, i) => {
        const d = new Date(Date.UTC(2024, 8, 1 + i)).toISOString().slice(0, 10)
        return [d, 0.04]
      }),
    )
    await expect(processarCalculo({
      supabase: fakeSb(tabelas), casoId: 'c1', dataBase: '2024-12-31',
      resolver: async () => ({ SELIC_DIARIA: selicExtended, IPCA: { '2024-09-01': 0.5, '2024-10-01': 0.5, '2024-11-01': 0.5 } }),
      cachePort: {}, fetchImpl: () => {},
    })).rejects.toMatchObject({ status: 422 })
  })

  it('série mensal resolvida vazia → 503 (não 500)', async () => {
    const tabelas = baseTabelas()
    await expect(processarCalculo({
      supabase: fakeSb(tabelas), casoId: 'c1', dataBase: '2024-09-30',
      resolver: async () => ({ SELIC_DIARIA: seriesFull.SELIC_DIARIA, IPCA: {} }),
      cachePort: {}, fetchImpl: () => {},
    })).rejects.toMatchObject({ status: 503 })
  })

  it('resolver que lança → 503 (não 500)', async () => {
    const tabelas = baseTabelas()
    await expect(processarCalculo({
      supabase: fakeSb(tabelas), casoId: 'c1', dataBase: '2024-09-30',
      resolver: async () => { throw new Error('SGS fora do ar') },
      cachePort: {}, fetchImpl: () => {},
    })).rejects.toMatchObject({ status: 503 })
  })

  it('mês SELIC sem nenhum dia (mesmo mês de venc e data-base) → 503', async () => {
    const tabelas = baseTabelas()
    await expect(processarCalculo({
      supabase: fakeSb(tabelas), casoId: 'c1', dataBase: '2024-09-20',
      resolver: async () => ({ SELIC_DIARIA: {}, IPCA: { '2024-09-01': 0.5 } }),
      cachePort: {}, fetchImpl: () => {},
    })).rejects.toMatchObject({ status: 503 })
  })
})

// ─────────────────  Plano 04b — modo projeção  ─────────────────

function diarioFlat(deISO, ateISO, taxa = 0.04) {
  const out = {}
  let t = Date.parse(`${deISO}T00:00:00Z`)
  const fim = Date.parse(`${ateISO}T00:00:00Z`)
  while (t <= fim) {
    out[new Date(t).toISOString().slice(0, 10)] = taxa
    t += 86400000
  }
  return out
}

const parcelaProj = [{ id: 'p1', competencia: '2026-06-01', vencimento: '2026-06-10', valor_devido: 1000, ativa: true }]

describe('processarCalculo — projeção (04b)', () => {
  it('sem permitirProjecao: 422 quando a data-base passa do último índice firme', async () => {
    const tabelas = baseTabelas({ pensao_parcelas: { data: parcelaProj, error: null } })
    await expect(processarCalculo({
      supabase: fakeSb(tabelas), casoId: 'c1', dataBase: '2026-11-15',
      resolver: async () => ({
        SELIC_DIARIA: diarioFlat('2026-06-01', '2026-08-31'),
        IPCA: { '2026-06-01': 0.3, '2026-07-01': 0.3, '2026-08-01': 0.3 },
      }),
      cachePort: {}, fetchImpl: () => {},
    })).rejects.toMatchObject({ status: 422 })
  })

  it('com permitirProjecao e IPCA: projeta pelo Focus, marca as linhas e grava dois totais + boletim', async () => {
    const tabelas = baseTabelas({ pensao_parcelas: { data: parcelaProj, error: null } })
    const resolverProjecaoImpl = vi.fn(async () => ({
      dataBoletim: '2026-09-05',
      series: {
        IPCA: { '2026-09-01': 0.30, '2026-10-01': 0.32, '2026-11-01': 0.28 },
        SELIC: { '2026-09-01': 15, '2026-10-01': 15, '2026-11-01': 15 },
      },
    }))
    const out = await processarCalculo({
      supabase: fakeSb(tabelas), casoId: 'c1', dataBase: '2026-11-15',
      resolver: async () => ({
        SELIC_DIARIA: diarioFlat('2026-06-01', '2026-08-31'),
        IPCA: { '2026-06-01': 0.3, '2026-07-01': 0.3, '2026-08-01': 0.3 },
      }),
      cachePort: {}, fetchImpl: () => {},
      permitirProjecao: true, projecoesManuais: [], resolverProjecaoImpl, cachePortFocus: {},
    })
    expect(out).toMatchObject({ versao: 1 })
    const ins = tabelas.__inserted__
    expect(ins.linhas.every((l) => l.projetado === true || l.projetado === false)).toBe(true)
    expect(ins.linhas.some((l) => l.projetado)).toBe(true)
    expect(ins.totais).toHaveProperty('saldoAteUltimoIndiceFirme')
    expect(ins.totais).toHaveProperty('saldoComProjecao')
    expect(ins.parametros_snapshot.projecao.dataBoletimFocus).toBe('2026-09-05')
    expect(resolverProjecaoImpl).toHaveBeenCalled()
  })

  it('índice INPC sem projeção manual para um mês → 422 apontando o mês', async () => {
    const tabelas = baseTabelas({
      pensao_parcelas: { data: parcelaProj, error: null },
      pensao_parametros: { data: { ...paramsOk, indice_correcao: 'INPC', regime_juros_convencionado: '1_am_simples' }, error: null },
    })
    await expect(processarCalculo({
      supabase: fakeSb(tabelas), casoId: 'c1', dataBase: '2026-11-15',
      resolver: async () => ({
        SELIC_DIARIA: {},
        INPC: { '2026-06-01': 0.3, '2026-07-01': 0.3, '2026-08-01': 0.3 },
      }),
      cachePort: {}, fetchImpl: () => {},
      permitirProjecao: true,
      projecoesManuais: [{ competencia: '2026-09-01', taxa: 0.3, fonte: 'x' }],
      resolverProjecaoImpl: vi.fn(), cachePortFocus: {},
    })).rejects.toMatchObject({ status: 422 })
  })

  // ── I-3: fixa saldos projetado/firme a valores calculados à mão ──
  //
  // Cenário: 1 parcela de R$ 1.000,00, vencimento 2026-08-01, índice IPCA
  // convencionado, juros 1% a.m. simples pró-rata die.
  //   Série firme: IPCA 2026-08 = 0,40%.  Última competência firme = 2026-08
  //     → firme recalcula com data-base recuada para 2026-08-31.
  //   Mês projetado: IPCA 2026-09 = 0,32% (do Focus).  data-base = 2026-09-11.
  //
  // SALDO COM PROJEÇÃO — janela 2026-08-01 → 2026-09-11 (41 dias corridos):
  //   Correção IPCA pró-rata die:
  //     agosto cheio (31/31) a 0,40%  → 1,00400000
  //     setembro parcial (10/30) a 0,32% → 1 + 0,0032·(10/30) = 1,00106667
  //     fator composto = 1,00400000 · 1,00106667 = 1,00507093
  //     correção = 1000 · 0,00507093 = 5,07
  //   Juros 1% a.m. simples sobre o corrigido:
  //     (1000 + 5,07093) · 0,01 · (41/30) = 1005,07093 · 0,0136667 = 13,74
  //   saldo = 1000 + 5,07 + 13,74 = 1018,81
  //
  // SALDO ATÉ O ÚLTIMO ÍNDICE FIRME — janela 2026-08-01 → 2026-08-31 (30 dias):
  //   Correção só agosto, 30/31 dias a 0,40% → 1000 · (0,004 · 30/31) = 3,87
  //   Juros = (1000 + 3,87) · 0,01 · (30/30) = 10,04
  //   saldo firme = 1000 + 3,87 + 10,04 = 1013,91
  it('I-3: saldos projetado e firme batem com o cálculo manual (não só toHaveProperty)', async () => {
    const tabelas = baseTabelas({
      pensao_parcelas: { data: [{ id: 'p1', competencia: '2026-08-01', vencimento: '2026-08-01', valor_devido: 1000, ativa: true }], error: null },
      pensao_parametros: { data: { ...paramsOk, indice_correcao: 'IPCA', regime_juros_convencionado: '1_am_simples' }, error: null },
    })
    const resolverProjecaoImpl = vi.fn(async () => ({
      dataBoletim: '2026-09-05',
      series: { IPCA: { '2026-09-01': 0.32 } },
    }))
    await processarCalculo({
      supabase: fakeSb(tabelas), casoId: 'c1', dataBase: '2026-09-11',
      // SELIC_DIARIA cobre o mês firme (a rota exige ≥1 dia por mês firme
      // mesmo quando o regime não usa SELIC); não entra na conta com juros 1% a.m.
      resolver: async () => ({ IPCA: { '2026-08-01': 0.40 }, SELIC_DIARIA: diarioFlat('2026-08-01', '2026-08-31') }),
      cachePort: {}, fetchImpl: () => {},
      permitirProjecao: true, projecoesManuais: [], resolverProjecaoImpl, cachePortFocus: {},
    })
    const ins = tabelas.__inserted__
    expect(ins.linhas[0].correcao.valor).toBe(5.07)
    expect(ins.linhas[0].juros.valor).toBe(13.74)
    expect(ins.totais.saldoComProjecao).toBe(1018.81)
    expect(ins.totais.saldo).toBe(1018.81)
    expect(ins.totais.saldoAteUltimoIndiceFirme).toBe(1013.91)
  })

  it('I-3: duas execuções com o mesmo input → JSON idêntico (linhas e totais)', async () => {
    const args = () => ({
      casoId: 'c1', dataBase: '2026-09-11',
      resolver: async () => ({ IPCA: { '2026-08-01': 0.40 }, SELIC_DIARIA: diarioFlat('2026-08-01', '2026-08-31') }),
      cachePort: {}, fetchImpl: () => {},
      permitirProjecao: true, projecoesManuais: [],
      resolverProjecaoImpl: vi.fn(async () => ({ dataBoletim: '2026-09-05', series: { IPCA: { '2026-09-01': 0.32 } } })),
      cachePortFocus: {},
    })
    const mk = () => baseTabelas({
      pensao_parcelas: { data: [{ id: 'p1', competencia: '2026-08-01', vencimento: '2026-08-01', valor_devido: 1000, ativa: true }], error: null },
      pensao_parametros: { data: { ...paramsOk, indice_correcao: 'IPCA', regime_juros_convencionado: '1_am_simples' }, error: null },
    })
    const t1 = mk(); await processarCalculo({ supabase: fakeSb(t1), ...args() })
    const t2 = mk(); await processarCalculo({ supabase: fakeSb(t2), ...args() })
    expect(JSON.stringify(t1.__inserted__.linhas)).toBe(JSON.stringify(t2.__inserted__.linhas))
    expect(JSON.stringify(t1.__inserted__.totais)).toBe(JSON.stringify(t2.__inserted__.totais))
  })
})
