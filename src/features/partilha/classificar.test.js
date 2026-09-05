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

  // Paridade cliente × servidor: as abas (AbaBens/AbaCenarios) montam `marcos` a
  // partir de partilha_config exatamente como api/partilha/calcular.js faz —
  // incluindo dataAjuizamento. Sem ela o fim da constância cai no sentinela
  // 9999-12-31 no cliente e o mesmo bem sai comunicável ali e particular no servidor.
  const config = {
    regime_bens: 'comunhao_parcial', data_casamento: '2015-01-01',
    data_separacao_fato: null, separacao_fato_efeito: 'corta_comunicacao',
    data_ajuizamento: '2022-01-01',
  }
  // mesma montagem de api/partilha/calcular.js
  const marcosServidor = {
    dataCasamento: config.data_casamento,
    dataSeparacaoFato: config.data_separacao_fato || null,
    separacaoFatoEfeito: config.separacao_fato_efeito,
    dataAjuizamento: config.data_ajuizamento || null,
  }
  // mesma montagem das abas do cliente
  const marcosCliente = {
    dataCasamento: config.data_casamento,
    dataSeparacaoFato: config.data_separacao_fato,
    separacaoFatoEfeito: config.separacao_fato_efeito,
    dataAjuizamento: config.data_ajuizamento || null,
  }
  const bemPosAjuizamento = { formaAquisicao: 'oneroso', dataAquisicao: '2023-05-01', titular: 'parte_a' }

  it('cliente e servidor dão o MESMO veredito para bem adquirido após o ajuizamento', () => {
    const noCliente = classificarBem({ bem: bemPosAjuizamento, regimeBens: config.regime_bens, marcos: marcosCliente })
    const noServidor = classificarBem({ bem: bemPosAjuizamento, regimeBens: config.regime_bens, marcos: marcosServidor })
    expect(noCliente).toEqual(noServidor)
    expect(noCliente.classificacao).toBe('particular')
  })

  it('omitir dataAjuizamento no cliente mudaria o veredito — por isso ela é obrigatória', () => {
    const { dataAjuizamento, ...marcosSemAjuizamento } = marcosCliente
    expect(dataAjuizamento).toBe('2022-01-01')
    const semAjuizamento = classificarBem({ bem: bemPosAjuizamento, regimeBens: config.regime_bens, marcos: marcosSemAjuizamento })
    expect(semAjuizamento.classificacao).toBe('comunicavel') // divergiria do servidor
  })
})
