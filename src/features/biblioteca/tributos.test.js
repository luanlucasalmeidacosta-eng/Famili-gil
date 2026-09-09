import { describe, it, expect } from 'vitest'
import { validarFaixasItcmd, calcularValorItcmd } from './tributos.js'

describe('biblioteca/tributos (reexport)', () => {
  it('reexporta validarFaixasItcmd', () => {
    expect(validarFaixasItcmd([{ ate: null, aliquota: 4 }])).toEqual({ ok: true })
  })
  it('reexporta calcularValorItcmd', () => {
    expect(calcularValorItcmd(50000, [{ ate: null, aliquota: 4 }])).toBe(2000)
  })
})
