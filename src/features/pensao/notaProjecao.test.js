import { describe, it, expect } from 'vitest'
import { NOTA_PROJECAO_PADRAO } from './notaProjecao.js'

describe('NOTA_PROJECAO_PADRAO', () => {
  it('é um texto não-vazio, neutro, mencionando os dois entendimentos', () => {
    expect(typeof NOTA_PROJECAO_PADRAO).toBe('string')
    expect(NOTA_PROJECAO_PADRAO.length).toBeGreaterThan(200)
    expect(NOTA_PROJECAO_PADRAO).toMatch(/controvert/i)
    expect(NOTA_PROJECAO_PADRAO).toMatch(/liquida[çc][ãa]o/i)
  })
})
