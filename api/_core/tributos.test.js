import { describe, it, expect } from 'vitest'
import { validarFaixasItcmd, calcularValorItcmd } from './tributos.js'

describe('validarFaixasItcmd', () => {
  it('aceita faixas ordenadas, contíguas, com última aberta', () => {
    expect(validarFaixasItcmd([{ ate: 100000, aliquota: 4 }, { ate: 200000, aliquota: 6 }, { ate: null, aliquota: 8 }]))
      .toEqual({ ok: true })
  })
  it('aceita uma única faixa aberta', () => {
    expect(validarFaixasItcmd([{ ate: null, aliquota: 4 }])).toEqual({ ok: true })
  })
  it('rejeita lista vazia', () => {
    expect(validarFaixasItcmd([]).ok).toBe(false)
  })
  it('rejeita quando a última faixa não é aberta', () => {
    expect(validarFaixasItcmd([{ ate: 100000, aliquota: 4 }]).ok).toBe(false)
  })
  it('rejeita duas faixas abertas', () => {
    expect(validarFaixasItcmd([{ ate: null, aliquota: 4 }, { ate: null, aliquota: 6 }]).ok).toBe(false)
  })
  it('rejeita faixa aberta que não é a última', () => {
    expect(validarFaixasItcmd([{ ate: null, aliquota: 4 }, { ate: 200000, aliquota: 6 }]).ok).toBe(false)
  })
  it('rejeita faixas fora de ordem', () => {
    expect(validarFaixasItcmd([{ ate: 200000, aliquota: 6 }, { ate: 100000, aliquota: 4 }, { ate: null, aliquota: 8 }]).ok).toBe(false)
  })
  it('rejeita ate igual entre faixas (sobreposição/degenerada)', () => {
    expect(validarFaixasItcmd([{ ate: 100000, aliquota: 4 }, { ate: 100000, aliquota: 6 }, { ate: null, aliquota: 8 }]).ok).toBe(false)
  })
  it('rejeita alíquota negativa', () => {
    expect(validarFaixasItcmd([{ ate: null, aliquota: -1 }]).ok).toBe(false)
  })
  it('rejeita ate não-positivo', () => {
    expect(validarFaixasItcmd([{ ate: 0, aliquota: 4 }, { ate: null, aliquota: 6 }]).ok).toBe(false)
  })
})

describe('calcularValorItcmd', () => {
  const faixas = [{ ate: 100000, aliquota: 4 }, { ate: 200000, aliquota: 6 }, { ate: null, aliquota: 8 }]
  it('base 0 → 0', () => {
    expect(calcularValorItcmd(0, faixas)).toBe(0)
  })
  it('base dentro da primeira faixa', () => {
    expect(calcularValorItcmd(50000, faixas)).toBe(2000) // 50000 * 4%
  })
  it('base exatamente na fronteira da primeira faixa', () => {
    expect(calcularValorItcmd(100000, faixas)).toBe(4000) // 100000 * 4%
  })
  it('base atravessando duas faixas', () => {
    // 100000*4% + 50000*6% = 4000 + 3000 = 7000
    expect(calcularValorItcmd(150000, faixas)).toBe(7000)
  })
  it('base exatamente na fronteira da segunda faixa', () => {
    // 100000*4% + 100000*6% = 4000 + 6000 = 10000
    expect(calcularValorItcmd(200000, faixas)).toBe(10000)
  })
  it('base acima do topo entra na faixa aberta', () => {
    // 4000 + 6000 + 50000*8% = 10000 + 4000 = 14000
    expect(calcularValorItcmd(250000, faixas)).toBe(14000)
  })
  it('faixa única aberta = alíquota plana', () => {
    expect(calcularValorItcmd(123456.78, [{ ate: null, aliquota: 4 }])).toBe(4938.27) // arredonda2(4938.2712)
  })
  it('lança se as faixas forem inválidas', () => {
    expect(() => calcularValorItcmd(1000, [{ ate: 100, aliquota: 4 }])).toThrow()
  })
})
