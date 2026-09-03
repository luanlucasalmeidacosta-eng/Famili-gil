import { describe, it, expect } from 'vitest'
import { SERIES, janelasDe10Anos } from './indices-bcb.js'

describe('SERIES', () => {
  it('tem os códigos SGS do spec', () => {
    expect(SERIES).toEqual({ SELIC_DIARIA: 11, IPCA: 433, INPC: 188, IGPM: 189, IPCA15: 7478 })
  })
})

describe('janelasDe10Anos', () => {
  it('intervalo curto → uma janela só, em formato BR', () => {
    expect(janelasDe10Anos('2020-01-01', '2024-06-30')).toEqual([
      { inicioBR: '01/01/2020', fimBR: '30/06/2024' },
    ])
  })

  it('intervalo de 25 anos → 3 janelas contíguas de no máx. 10 anos', () => {
    const js = janelasDe10Anos('2000-01-01', '2025-01-01')
    expect(js).toEqual([
      { inicioBR: '01/01/2000', fimBR: '31/12/2009' },
      { inicioBR: '01/01/2010', fimBR: '31/12/2019' },
      { inicioBR: '01/01/2020', fimBR: '01/01/2025' },
    ])
  })

  it('rejeita intervalo invertido', () => {
    expect(() => janelasDe10Anos('2025-01-01', '2020-01-01')).toThrow()
  })
})
