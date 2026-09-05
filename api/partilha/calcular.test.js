import { describe, it, expect } from 'vitest'
import { processarCalculo } from './calcular.js'

function fakeSb(tabelas) {
  return {
    from(t) {
      const cfg = tabelas[t] || { data: null, error: null }
      const b = {
        select() { return b }, eq() { return b }, order() { return b }, limit() { return b },
        maybeSingle() { return Promise.resolve(cfg) },
        then(res) { return Promise.resolve(cfg).then(res) },
        insert() { return { select() { return { single() { return Promise.resolve({ data: { id: 'mem1' }, error: null }) } } } } },
      }
      return b
    },
  }
}

const configOk = { regime_bens: 'comunhao_parcial', data_casamento: '2015-01-01', data_separacao_fato: null, separacao_fato_efeito: 'corta_comunicacao', data_ajuizamento: null }
const bensOk = [{ id: 'b1', descricao: 'Casa', tipo: 'imovel', valor_mercado: 400000, data_aquisicao: '2018-01-01', forma_aquisicao: 'oneroso', clausula_incomunicabilidade: false, titular: 'parte_a', financiado: false, saldo_devedor: null, classificacao_override: null }]
const cenarioOk = { id: 'c1', pct_parte_a: 50, alocacoes: [{ bemId: 'b1', para: 'parte_a' }], tornas: [] }

function baseTabelas(over = {}) {
  return {
    casos: { data: { id: 'caso1', parte_a: 'A', parte_b: 'B' }, error: null },
    partilha_config: { data: configOk, error: null },
    partilha_bens: { data: bensOk, error: null },
    partilha_passivos: { data: [], error: null },
    partilha_cenarios: { data: cenarioOk, error: null },
    partilha_memoria: { data: null, error: null },
    ...over,
  }
}

describe('processarCalculo', () => {
  it('caminho feliz → grava versão 1', async () => {
    const out = await processarCalculo({ supabase: fakeSb(baseTabelas()), casoId: 'caso1', cenarioId: 'c1' })
    expect(out).toEqual({ memoriaId: 'mem1', versao: 1 })
  })

  it('sem config → 422', async () => {
    const tabelas = baseTabelas({ partilha_config: { data: null, error: null } })
    await expect(processarCalculo({ supabase: fakeSb(tabelas), casoId: 'caso1', cenarioId: 'c1' }))
      .rejects.toMatchObject({ status: 422 })
  })

  it('caso não encontrado → 404', async () => {
    const tabelas = baseTabelas({ casos: { data: null, error: null } })
    await expect(processarCalculo({ supabase: fakeSb(tabelas), casoId: 'caso1', cenarioId: 'c1' }))
      .rejects.toMatchObject({ status: 404 })
  })

  it('cenário não encontrado → 404', async () => {
    const tabelas = baseTabelas({ partilha_cenarios: { data: null, error: null } })
    await expect(processarCalculo({ supabase: fakeSb(tabelas), casoId: 'caso1', cenarioId: 'c1' }))
      .rejects.toMatchObject({ status: 404 })
  })

  it('incrementa versão de v2 → v3', async () => {
    const tabelas = baseTabelas({ partilha_memoria: { data: { versao: 2 }, error: null } })
    const out = await processarCalculo({ supabase: fakeSb(tabelas), casoId: 'caso1', cenarioId: 'c1' })
    expect(out).toEqual({ memoriaId: 'mem1', versao: 3 })
  })

  it('bem pendente (sem formaAquisicao) não bloqueia cálculo', async () => {
    const bemPendente = {
      id: 'b2',
      descricao: 'Carro',
      tipo: 'veiculo',
      valor_mercado: 50000,
      data_aquisicao: '2020-06-01',
      forma_aquisicao: null,
      clausula_incomunicabilidade: false,
      titular: 'parte_b',
      financiado: false,
      saldo_devedor: null,
      classificacao_override: null,
    }
    const tabelas = baseTabelas({ partilha_bens: { data: [bensOk[0], bemPendente], error: null } })
    const out = await processarCalculo({ supabase: fakeSb(tabelas), casoId: 'caso1', cenarioId: 'c1' })
    expect(out).toEqual({ memoriaId: 'mem1', versao: 1 })
  })
})
