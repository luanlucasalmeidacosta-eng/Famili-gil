import { describe, it, expect } from 'vitest'
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
