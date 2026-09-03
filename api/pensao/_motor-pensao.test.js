import { describe, it, expect } from 'vitest'
import { arredonda2, diasCorridos, diasNoMes, FRONTEIRA_LEI, partesTrecho } from './_motor-pensao.js'

describe('arredonda2', () => {
  it('meio para cima', () => {
    expect(arredonda2(1.005)).toBe(1.01)
    expect(arredonda2(2.344)).toBe(2.34)
    expect(arredonda2(2.345)).toBe(2.35)
    expect(arredonda2(423.6)).toBe(423.6)
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
