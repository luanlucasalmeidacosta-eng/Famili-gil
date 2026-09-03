import { describe, it, expect } from 'vitest'
import { gerarSerie } from './gerarSerie.js'

const base = {
  tipoValor: 'fixo', valorBase: 1000, diaVencimento: 10,
  dataInicial: '2024-01-15', dataFinal: '2024-03-05',
}

describe('gerarSerie', () => {
  it('uma parcela por mês, competência no 1º dia, vencimento no dia informado', () => {
    expect(gerarSerie(base)).toEqual([
      { competencia: '2024-01-01', vencimento: '2024-01-10', valorDevido: 1000, origem: 'gerada', ativa: true },
      { competencia: '2024-02-01', vencimento: '2024-02-10', valorDevido: 1000, origem: 'gerada', ativa: true },
      { competencia: '2024-03-01', vencimento: '2024-03-10', valorDevido: 1000, origem: 'gerada', ativa: true },
    ])
  })

  it('dia de vencimento inexistente no mês → último dia do mês', () => {
    const s = gerarSerie({ ...base, diaVencimento: 31, dataInicial: '2024-02-01', dataFinal: '2024-02-29' })
    expect(s).toEqual([
      { competencia: '2024-02-01', vencimento: '2024-02-29', valorDevido: 1000, origem: 'gerada', ativa: true },
    ])
  })

  it('pct_salario_minimo aplica o percentual sobre o valor de referência informado', () => {
    const s = gerarSerie({
      tipoValor: 'pct_salario_minimo', valorBase: 30, salarioMinimoRef: 1412,
      diaVencimento: 5, dataInicial: '2024-05-01', dataFinal: '2024-05-31',
    })
    expect(s[0].valorDevido).toBe(423.6) // 30% de 1412
  })

  it('lança se dataInicial > dataFinal', () => {
    expect(() => gerarSerie({ ...base, dataInicial: '2024-04-01', dataFinal: '2024-01-01' })).toThrow()
  })

  it('lança se pct_rendimento sem rendimentoRef', () => {
    expect(() => gerarSerie({ ...base, tipoValor: 'pct_rendimento', rendimentoRef: undefined })).toThrow()
  })
})
