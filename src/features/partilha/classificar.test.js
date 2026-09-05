import { describe, it, expect } from 'vitest'
import { classificarBem } from './classificar.js'

describe('classificar (preview no cliente)', () => {
  it('reexporta a MESMA função do motor — mesmo resultado pro mesmo input', () => {
    const r = classificarBem({
      bem: { formaAquisicao: 'oneroso', dataAquisicao: '2018-01-01', titular: 'parte_a' },
      regimeBens: 'comunhao_parcial',
      marcos: { dataCasamento: '2015-01-01', dataSeparacaoFato: null, separacaoFatoEfeito: 'corta_comunicacao' },
    })
    expect(r).toMatchObject({ classificacao: 'comunicavel', regra: 'CC, art. 1.660, I' })
  })
})
