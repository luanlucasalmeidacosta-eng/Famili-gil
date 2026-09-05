import { describe, it, expect } from 'vitest'
import { arredonda2 } from './dinheiro.js'

describe('arredonda2', () => {
  it('meio para cima em x.xx5, incluindo magnitudes onde o epsilon-nudge falharia', () => {
    expect(arredonda2(1.005)).toBe(1.01)
    expect(arredonda2(2.344)).toBe(2.34)
    expect(arredonda2(2.345)).toBe(2.35)
    expect(arredonda2(5.015)).toBe(5.02)
    expect(arredonda2(8.005)).toBe(8.01)
    expect(arredonda2(100.005)).toBe(100.01)
    expect(arredonda2(423.6)).toBe(423.6)
    expect(arredonda2(0)).toBe(0)
  })
})
