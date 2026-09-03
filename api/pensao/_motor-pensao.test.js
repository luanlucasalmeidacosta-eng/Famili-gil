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
