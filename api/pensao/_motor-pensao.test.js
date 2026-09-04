import { describe, it, expect } from 'vitest'
import { arredonda2, diasCorridos, diasNoMes, FRONTEIRA_LEI, partesTrecho, fatorSelic, fatorMensal } from './_motor-pensao.js'

describe('arredonda2', () => {
  it('meio para cima', () => {
    expect(arredonda2(1.005)).toBe(1.01)
    expect(arredonda2(2.344)).toBe(2.34)
    expect(arredonda2(2.345)).toBe(2.35)
    expect(arredonda2(423.6)).toBe(423.6)
  })
  it('arredondamento half-up robusto em x.xx5 para operandos maiores', () => {
    expect(arredonda2(5.015)).toBe(5.02)
    expect(arredonda2(8.005)).toBe(8.01)
    expect(arredonda2(100.005)).toBe(100.01)
  })
})

describe('diasCorridos', () => {
  it('conta dias corridos, sinal inclusive', () => {
    expect(diasCorridos('2024-01-01', '2024-01-31')).toBe(30)
    expect(diasCorridos('2024-02-01', '2024-03-01')).toBe(29) // 2024 bissexto
    expect(diasCorridos('2024-03-01', '2024-02-01')).toBe(-29)
    expect(diasCorridos('2024-08-30', '2024-08-30')).toBe(0)
  })
})

describe('diasNoMes', () => {
  it('lida com bissexto e meses de 30/31', () => {
    expect(diasNoMes('2024-02-01')).toBe(29)
    expect(diasNoMes('2023-02-01')).toBe(28)
    expect(diasNoMes('2024-04-01')).toBe(30)
    expect(diasNoMes('2024-12-01')).toBe(31)
  })
})

describe('partesTrecho', () => {
  it('trecho todo antes da fronteira → um trecho "pre"', () => {
    expect(partesTrecho('2024-01-10', '2024-06-01')).toEqual([
      { ini: '2024-01-10', fim: '2024-06-01', regime: 'pre' },
    ])
  })
  it('trecho todo depois → um trecho "pos"', () => {
    expect(partesTrecho('2024-09-10', '2025-01-01')).toEqual([
      { ini: '2024-09-10', fim: '2025-01-01', regime: 'pos' },
    ])
  })
  it('trecho que cruza a fronteira → "pre" até 2024-08-30 e "pos" a partir dela', () => {
    expect(partesTrecho('2024-06-10', '2024-12-01')).toEqual([
      { ini: '2024-06-10', fim: '2024-08-30', regime: 'pre' },
      { ini: '2024-08-30', fim: '2024-12-01', regime: 'pos' },
    ])
  })
  it('dataBase <= vencimento → nenhum trecho', () => {
    expect(partesTrecho('2024-06-10', '2024-06-10')).toEqual([])
    expect(partesTrecho('2024-06-10', '2024-05-01')).toEqual([])
  })
  it('FRONTEIRA_LEI é 2024-08-30', () => {
    expect(FRONTEIRA_LEI).toBe('2024-08-30')
  })
})

describe('fatorSelic', () => {
  const serie = { '2024-09-02': 0.04, '2024-09-03': 0.04, '2024-09-04': 0.04 } // 3 dias úteis a 0.04%

  it('produto dos fatores diários no intervalo [ini, fim)', () => {
    // (1.0004)^3 = 1.00120048...
    expect(fatorSelic(serie, '2024-09-02', '2024-09-05')).toBeCloseTo(1.0004 ** 3, 10)
  })
  it('ini == fim → 1', () => {
    expect(fatorSelic(serie, '2024-09-02', '2024-09-02')).toBe(1)
  })
  it('só conta datas dentro de [ini, fim) — fim é exclusivo', () => {
    expect(fatorSelic(serie, '2024-09-02', '2024-09-03')).toBeCloseTo(1.0004, 10)
  })
  it('intervalo positivo sem nenhuma data na série → lança', () => {
    expect(() => fatorSelic(serie, '2024-10-01', '2024-10-31')).toThrow()
  })
})

describe('fatorMensal', () => {
  const ipca = { '2024-09-01': 1.0, '2024-10-01': 1.0, '2024-11-01': 1.0 } // 1%/mês

  it('mês cheio → (1 + m/100)', () => {
    // de 2024-09-01 a 2024-10-01 = setembro inteiro
    expect(fatorMensal(ipca, '2024-09-01', '2024-10-01')).toBeCloseTo(1.01, 10)
  })
  it('dois meses cheios compõem', () => {
    expect(fatorMensal(ipca, '2024-09-01', '2024-11-01')).toBeCloseTo(1.01 * 1.01, 10)
  })
  it('mês parcial nas pontas usa 1/diasNoMes por dia', () => {
    // de 2024-09-16 a 2024-10-01 = 15 dias de setembro (30 dias) → 1% * 15/30 = 0.5%
    expect(fatorMensal(ipca, '2024-09-16', '2024-10-01')).toBeCloseTo(1.005, 10)
  })
  it('falta a competência de um mês tocado → lança', () => {
    expect(() => fatorMensal(ipca, '2024-08-15', '2024-09-15')).toThrow() // falta 2024-08-01
  })
  it('mês-fim exclusivo (1º do mês) sem dados na série → não lança se ele não contribui dias', () => {
    expect(fatorMensal({ '2024-09-01': 1.0 }, '2024-09-01', '2024-10-01')).toBeCloseTo(1.01, 10)
  })
  it('ini == fim → 1', () => {
    expect(fatorMensal(ipca, '2024-09-01', '2024-09-01')).toBe(1)
  })
})

import { atualizarIntervalo, SERIE_DE_INDICE, distribuirPagamentos, calcularLinhaParcela, calcularMemoria } from './_motor-pensao.js'

// eslint-disable-next-line no-unused-vars
const selicZero = {} // sem dias -> fatorSelic lança se intervalo>0; usar quando não deve ser chamado
function selicFlat(taxa, de, ate) {
  // gera série diária plana de 'de' até 'ate' exclusivo
  const s = {}
  const d = new Date(`${de}T00:00:00Z`)
  const fim = new Date(`${ate}T00:00:00Z`)
  while (d < fim) { s[d.toISOString().slice(0, 10)] = taxa; d.setUTCDate(d.getUTCDate() + 1) }
  return s
}

describe('atualizarIntervalo — legal', () => {
  it('parcela toda no regime pré → só juros SELIC, correção 0', () => {
    const series = { SELIC_DIARIA: selicFlat(0.04, '2024-01-10', '2024-06-01') }
    const r = atualizarIntervalo({
      principal: 1000, ini: '2024-01-10', fim: '2024-06-01',
      indiceCorrecao: 'legal', regimeJuros: '1_am_simples', series,
    })
    expect(r.correcao).toBe(0)
    expect(r.juros).toBeGreaterThan(0)
    expect(r.fundamentos).toContain('STJ, REsp 1.795.982/SP (Corte Especial)')
    expect(r.fundamentos).toContain('CC, art. 397')
  })

  it('parcela toda no regime pós → correção IPCA; juros = max(0, SELIC−IPCA) com piso zero', () => {
    const series = {
      IPCA: { '2024-09-01': 1.0 },
      SELIC_DIARIA: selicFlat(0, '2024-09-01', '2024-10-01'), // SELIC 0 → fatorSelic ~1 < 1.01
    }
    const r = atualizarIntervalo({
      principal: 1000, ini: '2024-09-01', fim: '2024-10-01',
      indiceCorrecao: 'legal', regimeJuros: '1_am_simples', series,
    })
    expect(r.correcao).toBeCloseTo(10, 6) // 1% de 1000
    expect(r.juros).toBe(0)               // piso zero
    expect(r.fundamentos).toContain('Lei 14.905/2024 (arts. 389 e 406 do CC)')
  })

  it('intervalo que cruza a fronteira → dois trechos compostos (pré juros + pós correção)', () => {
    const series = {
      SELIC_DIARIA: selicFlat(0.02, '2024-08-01', '2024-10-01'),
      IPCA: { '2024-08-01': 0.5, '2024-09-01': 0.5 },
    }
    const r = atualizarIntervalo({
      principal: 1000, ini: '2024-08-01', fim: '2024-10-01',
      indiceCorrecao: 'legal', regimeJuros: '1_am_simples', series,
    })
    expect(r.correcao).toBeGreaterThan(0) // veio do trecho pós (IPCA)
    expect(r.juros).toBeGreaterThan(0)    // veio do trecho pré (SELIC) e talvez do pós
    expect(r.fundamentos).toEqual(expect.arrayContaining([
      'STJ, REsp 1.795.982/SP (Corte Especial)',
      'Lei 14.905/2024 (arts. 389 e 406 do CC)',
      'CC, art. 397',
    ]))
  })
})

describe('atualizarIntervalo — convencionado', () => {
  it('INPC + 1% a.m. simples', () => {
    const series = { INPC: { '2024-03-01': 1.0 } }
    const r = atualizarIntervalo({
      principal: 1000, ini: '2024-03-01', fim: '2024-04-01',
      indiceCorrecao: 'INPC', regimeJuros: '1_am_simples', series,
    })
    expect(r.correcao).toBeCloseTo(10, 6)      // INPC 1%
    expect(r.juros).toBeCloseTo(1010 * 0.01 * (31 / 30), 6) // 1% a.m. sobre corrigido, pró-rata 31 dias
    expect(r.fundamentos).toContain('título executivo')
  })

  it('IPCA-E mapeia para a série IPCA15', () => {
    expect(SERIE_DE_INDICE['IPCA-E']).toBe('IPCA15')
    const series = { IPCA15: { '2024-03-01': 2.0 } }
    const r = atualizarIntervalo({
      principal: 1000, ini: '2024-03-01', fim: '2024-04-01',
      indiceCorrecao: 'IPCA-E', regimeJuros: 'selic', series: { ...series, SELIC_DIARIA: selicFlat(0, '2024-03-01', '2024-04-01') },
    })
    expect(r.correcao).toBeCloseTo(20, 6)
  })

  it('série ausente → propaga o erro', () => {
    expect(() => atualizarIntervalo({
      principal: 1000, ini: '2024-03-01', fim: '2024-04-01',
      indiceCorrecao: 'INPC', regimeJuros: '1_am_simples', series: {},
    })).toThrow()
  })
})

const P = [
  { id: 'p1', vencimento: '2024-01-10', valorDevido: 1000 },
  { id: 'p2', vencimento: '2024-02-10', valorDevido: 1000 },
  { id: 'p3', vencimento: '2024-03-10', valorDevido: 1000 },
]

describe('distribuirPagamentos', () => {
  it('mais_antigas_primeiro: um pagamento de 1500 abate p1 inteira e 500 de p2', () => {
    const d = distribuirPagamentos({
      parcelasAtivas: P,
      pagamentos: [{ id: 'g1', dataPagamento: '2024-04-01', valor: 1500, identificadoPara: null }],
      regraImputacao: 'mais_antigas_primeiro',
    })
    expect(d.p1).toEqual([{ pagamentoId: 'g1', data: '2024-04-01', valor: 1000 }])
    expect(d.p2).toEqual([{ pagamentoId: 'g1', data: '2024-04-01', valor: 500 }])
    expect(d.p3).toBeUndefined()
  })

  it('identificado_para com excedente escorre como pagamento livre', () => {
    const d = distribuirPagamentos({
      parcelasAtivas: P,
      pagamentos: [{ id: 'g1', dataPagamento: '2024-04-01', valor: 1300, identificadoPara: 'p2' }],
      regraImputacao: 'mais_antigas_primeiro',
    })
    expect(d.p2).toEqual([{ pagamentoId: 'g1', data: '2024-04-01', valor: 1000 }])
    expect(d.p1).toEqual([{ pagamentoId: 'g1', data: '2024-04-01', valor: 300 }]) // 300 escorreu p/ a mais antiga
  })

  it('mais_recentes_primeiro inverte a ordem', () => {
    const d = distribuirPagamentos({
      parcelasAtivas: P,
      pagamentos: [{ id: 'g1', dataPagamento: '2024-04-01', valor: 1200, identificadoPara: null }],
      regraImputacao: 'mais_recentes_primeiro',
    })
    expect(d.p3).toEqual([{ pagamentoId: 'g1', data: '2024-04-01', valor: 1000 }])
    expect(d.p2).toEqual([{ pagamentoId: 'g1', data: '2024-04-01', valor: 200 }])
  })

  it('pro_rata rateia proporcional ao saldo nominal em aberto', () => {
    const d = distribuirPagamentos({
      parcelasAtivas: P,
      pagamentos: [{ id: 'g1', dataPagamento: '2024-04-01', valor: 300, identificadoPara: null }],
      regraImputacao: 'pro_rata',
    })
    expect(d.p1[0].valor).toBeCloseTo(100, 6)
    expect(d.p2[0].valor).toBeCloseTo(100, 6)
    expect(d.p3[0].valor).toBeCloseTo(100, 6)
  })

  it('pagamento além do total devido → bucket __excedente__', () => {
    const d = distribuirPagamentos({
      parcelasAtivas: P,
      pagamentos: [{ id: 'g1', dataPagamento: '2024-04-01', valor: 5000, identificadoPara: null }],
      regraImputacao: 'mais_antigas_primeiro',
    })
    expect(d.__excedente__[0].valor).toBeCloseTo(2000, 6)
  })
})

describe('calcularLinhaParcela', () => {
  const seriesNulas = { IPCA: { '2024-01-01': 0, '2024-02-01': 0, '2024-03-01': 0, '2024-04-01': 0, '2024-05-01': 0 } }

  it('sem correção/juros e sem pagamento → saldo = valor devido', () => {
    const linha = calcularLinhaParcela({
      parcela: { id: 'p1', competencia: '2024-03-01', vencimento: '2024-03-10', valorDevido: 1000 },
      abatimentos: [],
      dataBase: '2024-03-10', // igual ao vencimento → nenhum trecho
      dataCitacao: null,
      indiceCorrecao: 'legal', regimeJuros: '1_am_simples', series: seriesNulas,
    })
    expect(linha.valorDevidoOriginal).toBe(1000)
    expect(linha.correcao.valor).toBe(0)
    expect(linha.juros.valor).toBe(0)
    expect(linha.saldoAtualizado).toBe(1000)
    expect(linha.pagamentosAbatidos).toEqual([])
  })

  it('pagamento parcial abate na data e o resto segue como saldo', () => {
    const linha = calcularLinhaParcela({
      parcela: { id: 'p1', competencia: '2024-03-01', vencimento: '2024-03-10', valorDevido: 1000 },
      abatimentos: [{ pagamentoId: 'g1', data: '2024-03-20', valor: 400 }],
      dataBase: '2024-04-01',
      dataCitacao: null,
      indiceCorrecao: 'legal', regimeJuros: '1_am_simples',
      series: { SELIC_DIARIA: selicFlat(0, '2024-03-01', '2024-04-02') }, // legal + SELIC 0 → sem correção/juros
    })
    expect(linha.pagamentosAbatidos[0]).toMatchObject({ pagamentoId: 'g1', data: '2024-03-20', valorPago: 400 })
    expect(linha.saldoAtualizado).toBe(600) // 1000 - 400, sem correção/juros
  })

  it('dataBase == vencimento: abatimento aplicado UMA vez só', () => {
    const linha = calcularLinhaParcela({
      parcela: { id: 'p1', competencia: '2024-03-01', vencimento: '2024-03-10', valorDevido: 1000 },
      abatimentos: [{ pagamentoId: 'g1', data: '2024-03-10', valor: 300 }],
      dataBase: '2024-03-10',
      dataCitacao: null,
      indiceCorrecao: 'legal', regimeJuros: '1_am_simples',
      series: { SELIC_DIARIA: selicFlat(0, '2024-03-01', '2024-03-12') },
    })
    expect(linha.pagamentosAbatidos).toHaveLength(1)
    expect(linha.pagamentosAbatidos[0]).toMatchObject({ pagamentoId: 'g1', valorPago: 300 })
    expect(linha.saldoAtualizado).toBe(700) // 1000 - 300, uma vez só
  })

  it('pagamento EXATAMENTE no vencimento: sem acréscimo algum (não acrescenta o período inteiro antes de abater)', () => {
    const series = { SELIC_DIARIA: selicFlat(0.04, '2024-01-01', '2024-06-02') }
    const linha = calcularLinhaParcela({
      parcela: { id: 'p1', competencia: '2024-01-01', vencimento: '2024-01-10', valorDevido: 1000 },
      abatimentos: [{ pagamentoId: 'g1', data: '2024-01-10', valor: 1000 }],
      dataBase: '2024-06-01', dataCitacao: null,
      indiceCorrecao: 'legal', regimeJuros: '1_am_simples', series,
    })
    expect(linha.saldoAtualizado).toBe(0)
    expect(linha.juros.valor).toBe(0)
  })

  it('pagamento ANTES do vencimento: idem, sem acréscimo (não deve custar mais caro que pagar em dia)', () => {
    const series = { SELIC_DIARIA: selicFlat(0.04, '2024-01-01', '2024-06-02') }
    const linha = calcularLinhaParcela({
      parcela: { id: 'p1', competencia: '2024-01-01', vencimento: '2024-01-10', valorDevido: 1000 },
      abatimentos: [{ pagamentoId: 'g1', data: '2024-01-05', valor: 1000 }],
      dataBase: '2024-06-01', dataCitacao: null,
      indiceCorrecao: 'legal', regimeJuros: '1_am_simples', series,
    })
    expect(linha.saldoAtualizado).toBe(0)
  })

  it('pagamento 1 dia DEPOIS do vencimento: acresce só 1 dia, e deve custar mais que pagar em dia (nunca menos)', () => {
    const series = { SELIC_DIARIA: selicFlat(0.04, '2024-01-01', '2024-06-02') }
    const linha = calcularLinhaParcela({
      parcela: { id: 'p1', competencia: '2024-01-01', vencimento: '2024-01-10', valorDevido: 1000 },
      abatimentos: [{ pagamentoId: 'g1', data: '2024-01-11', valor: 1000 }],
      dataBase: '2024-06-01', dataCitacao: null,
      indiceCorrecao: 'legal', regimeJuros: '1_am_simples', series,
    })
    expect(linha.saldoAtualizado).toBeCloseTo(0.42, 2)
    expect(linha.saldoAtualizado).toBeGreaterThan(0)
  })
})

const seriesZero = { SELIC_DIARIA: selicFlat(0, '2024-01-01', '2024-04-02') }
const parcelas3 = [
  { id: 'p1', competencia: '2024-01-01', vencimento: '2024-01-10', valorDevido: 1000, ativa: true },
  { id: 'p2', competencia: '2024-02-01', vencimento: '2024-02-10', valorDevido: 1000, ativa: true },
  { id: 'p3', competencia: '2024-03-01', vencimento: '2024-03-10', valorDevido: 1000, ativa: false },
]

describe('calcularMemoria', () => {
  const entrada = {
    parcelas: parcelas3,
    pagamentos: [{ id: 'g1', dataPagamento: '2024-03-01', valor: 500, identificadoPara: null }],
    dataBase: '2024-04-01', dataCitacao: null,
    indiceCorrecao: 'legal', regraImputacao: 'mais_antigas_primeiro',
    regimeJurosConvencionado: '1_am_simples', series: seriesZero,
  }

  it('ignora parcela inativa; soma bate; pagamento abatido da mais antiga', () => {
    const m = calcularMemoria(entrada)
    expect(m.linhas.map((l) => l.parcelaId)).toEqual(['p1', 'p2']) // p3 inativa fora
    expect(m.totais.somaOriginal).toBe(2000)
    expect(m.totais.somaPagamentos).toBe(500)
    expect(m.totais.saldo).toBe(1500)
    expect(m.linhas[0].pagamentosAbatidos[0].valorPago).toBe(500)
  })

  it('alerta de retroação quando a parcela vence antes da citação', () => {
    const m = calcularMemoria({ ...entrada, dataCitacao: '2024-02-01' })
    expect(m.alertas.some((a) => a.includes('vence antes da citação'))).toBe(true)
  })

  it('alerta quando os pagamentos superam o débito', () => {
    const m = calcularMemoria({
      ...entrada,
      pagamentos: [{ id: 'g1', dataPagamento: '2024-03-01', valor: 9000, identificadoPara: null }],
    })
    expect(m.alertas.some((a) => a.includes('superam o débito'))).toBe(true)
  })

  it('determinístico: dois runs → JSON idêntico', () => {
    expect(JSON.stringify(calcularMemoria(entrada))).toBe(JSON.stringify(calcularMemoria(entrada)))
  })

  it('overpayment: excedente cobre o residual de juros; saldo zera; alerta mostra a SOBRA real, não o residual não-coberto', () => {
    const series = { SELIC_DIARIA: selicFlat(0.04, '2024-01-01', '2024-06-02') }
    const m = calcularMemoria({
      parcelas: [
        { id: 'p1', competencia: '2024-01-01', vencimento: '2024-01-10', valorDevido: 1000, ativa: true },
        { id: 'p2', competencia: '2024-02-01', vencimento: '2024-02-10', valorDevido: 1000, ativa: true },
      ],
      pagamentos: [{ id: 'g1', dataPagamento: '2024-03-01', valor: 9000, identificadoPara: null }],
      dataBase: '2024-06-01', dataCitacao: null,
      indiceCorrecao: 'legal', regraImputacao: 'mais_antigas_primeiro',
      regimeJurosConvencionado: '1_am_simples', series,
    })
    expect(m.totais.saldo).toBe(0)
    expect(m.linhas.every((l) => l.saldoAtualizado === 0)).toBe(true)
    expect(m.alertas.some((a) => a.includes('superam o débito'))).toBe(true)
    const alerta = m.alertas.find((a) => a.includes('superam o débito'))
    const valorNoAlerta = Number(alerta.match(/R\$ ([\d.]+)/)[1])
    expect(valorNoAlerta).toBeCloseTo(6971.36, 1)
  })

  it('overpayment com data do excedente BEM anterior à data-base: totais reconciliam e o alerta bate com a sobra real', () => {
    const series = { SELIC_DIARIA: selicFlat(0.04, '2020-01-01', '2025-01-02') }
    const m = calcularMemoria({
      parcelas: [
        { id: 'p1', competencia: '2020-01-01', vencimento: '2020-01-10', valorDevido: 1000, ativa: true },
        { id: 'p2', competencia: '2020-02-01', vencimento: '2020-02-10', valorDevido: 1000, ativa: true },
      ],
      pagamentos: [{ id: 'g1', dataPagamento: '2021-03-01', valor: 9000, identificadoPara: null }],
      dataBase: '2024-08-01', dataCitacao: null,
      indiceCorrecao: 'legal', regraImputacao: 'mais_antigas_primeiro',
      regimeJurosConvencionado: '1_am_simples', series,
    })
    const { somaOriginal, somaCorrecao, somaJuros, somaPagamentos, saldo } = m.totais
    expect(Math.abs(somaOriginal + somaCorrecao + somaJuros - somaPagamentos - saldo)).toBeLessThan(0.02)
    expect(saldo).toBe(0)
  })

  it('pro_rata com overpayment parcial (não cobre tudo): sem alerta de excedente, saldo residual pequeno e reconciliado', () => {
    const series = { SELIC_DIARIA: selicFlat(0.04, '2024-01-01', '2024-07-02') }
    const m = calcularMemoria({
      parcelas: [
        { id: 'p1', competencia: '2024-01-01', vencimento: '2024-01-10', valorDevido: 1000, ativa: true },
        { id: 'p2', competencia: '2024-02-01', vencimento: '2024-02-10', valorDevido: 1000, ativa: true },
        { id: 'p3', competencia: '2024-03-01', vencimento: '2024-03-10', valorDevido: 1000, ativa: true },
      ],
      pagamentos: [{ id: 'g1', dataPagamento: '2024-04-01', valor: 3050, identificadoPara: null }],
      dataBase: '2024-06-01', dataCitacao: null,
      indiceCorrecao: 'legal', regraImputacao: 'pro_rata',
      regimeJurosConvencionado: '1_am_simples', series,
    })
    const { somaOriginal, somaCorrecao, somaJuros, somaPagamentos, saldo } = m.totais
    expect(Math.abs(somaOriginal + somaCorrecao + somaJuros - somaPagamentos - saldo)).toBeLessThan(0.02)
    expect(m.alertas.some((a) => a.includes('superam o débito'))).toBe(false)
    expect(saldo).toBeGreaterThan(0)
    expect(saldo).toBeLessThan(20)
  })
})
