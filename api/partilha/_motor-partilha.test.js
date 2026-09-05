import { describe, it, expect } from 'vitest'
import { classificarBem } from './_motor-partilha.js'

const marcosPadrao = { dataCasamento: '2015-01-01', dataSeparacaoFato: null, separacaoFatoEfeito: 'corta_comunicacao' }

describe('classificarBem — comunhão parcial', () => {
  const regimeBens = 'comunhao_parcial'

  it('oneroso na constância → comunicável (art. 1.660, I)', () => {
    const r = classificarBem({
      bem: { formaAquisicao: 'oneroso', dataAquisicao: '2018-06-01', titular: 'parte_a' },
      regimeBens, marcos: marcosPadrao,
    })
    expect(r).toMatchObject({ classificacao: 'comunicavel', regra: 'CC, art. 1.660, I', origem: 'automatica' })
  })

  it('fato eventual na constância → comunicável (art. 1.660, II)', () => {
    const r = classificarBem({
      bem: { formaAquisicao: 'fato_eventual', dataAquisicao: '2019-01-01', titular: 'parte_a' },
      regimeBens, marcos: marcosPadrao,
    })
    expect(r.classificacao).toBe('comunicavel')
    expect(r.regra).toBe('CC, art. 1.660, II')
  })

  it('doação/herança em favor de ambos → comunicável (art. 1.660, III)', () => {
    const r = classificarBem({
      bem: { formaAquisicao: 'heranca', dataAquisicao: '2020-01-01', titular: 'ambos' },
      regimeBens, marcos: marcosPadrao,
    })
    expect(r.classificacao).toBe('comunicavel')
    expect(r.regra).toBe('CC, art. 1.660, III')
  })

  it('herança em favor de um só → particular (art. 1.659, I)', () => {
    const r = classificarBem({
      bem: { formaAquisicao: 'heranca', dataAquisicao: '2020-01-01', titular: 'parte_a' },
      regimeBens, marcos: marcosPadrao,
    })
    expect(r.classificacao).toBe('particular')
    expect(r.regra).toBe('CC, art. 1.659, I')
  })

  it('bem anterior ao casamento → particular (art. 1.659, I / art. 1.661)', () => {
    const r = classificarBem({
      bem: { formaAquisicao: 'oneroso', dataAquisicao: '2010-01-01', titular: 'parte_a' },
      regimeBens, marcos: marcosPadrao,
    })
    expect(r.classificacao).toBe('particular')
    expect(r.regra).toBe('CC, art. 1.659, I / art. 1.661')
  })

  it('sub-rogação → particular (art. 1.659, II)', () => {
    const r = classificarBem({
      bem: { formaAquisicao: 'sub_rogacao', dataAquisicao: '2019-01-01', titular: 'parte_a' },
      regimeBens, marcos: marcosPadrao,
    })
    expect(r.classificacao).toBe('particular')
    expect(r.regra).toBe('CC, art. 1.659, II')
  })

  it('bem de uso pessoal / proventos → particular (art. 1.659, V a VII)', () => {
    const r = classificarBem({
      bem: { formaAquisicao: 'beneficiaria_particular', dataAquisicao: '2019-01-01', titular: 'parte_a' },
      regimeBens, marcos: marcosPadrao,
    })
    expect(r.classificacao).toBe('particular')
    expect(r.regra).toBe('CC, art. 1.659, V a VII')
  })

  it('falta formaAquisicao → pendente, aponta o campo', () => {
    const r = classificarBem({
      bem: { formaAquisicao: null, dataAquisicao: '2019-01-01', titular: 'parte_a' },
      regimeBens, marcos: marcosPadrao,
    })
    expect(r).toMatchObject({ classificacao: 'pendente', origem: 'pendente', campoFaltante: 'formaAquisicao' })
  })

  it('oneroso sem dataAquisicao → pendente, aponta o campo', () => {
    const r = classificarBem({
      bem: { formaAquisicao: 'oneroso', dataAquisicao: null, titular: 'parte_a' },
      regimeBens, marcos: marcosPadrao,
    })
    expect(r).toMatchObject({ classificacao: 'pendente', campoFaltante: 'dataAquisicao' })
  })

  it('classificacaoOverride sempre vence, sem consultar regra', () => {
    const r = classificarBem({
      bem: { formaAquisicao: 'oneroso', dataAquisicao: '2010-01-01', titular: 'parte_a', classificacaoOverride: 'comunicavel' },
      regimeBens, marcos: marcosPadrao,
    })
    expect(r).toMatchObject({ classificacao: 'comunicavel', origem: 'override' })
  })
})

describe('classificarBem — comunhão universal', () => {
  const regimeBens = 'comunhao_universal'

  it('comunicável por padrão (art. 1.667)', () => {
    const r = classificarBem({
      bem: { formaAquisicao: 'oneroso', dataAquisicao: '2019-01-01', titular: 'parte_a', clausulaIncomunicabilidade: false },
      regimeBens, marcos: marcosPadrao,
    })
    expect(r).toMatchObject({ classificacao: 'comunicavel', regra: 'CC, art. 1.667' })
  })

  it('cláusula de incomunicabilidade → particular (art. 1.668, I)', () => {
    const r = classificarBem({
      bem: { formaAquisicao: 'heranca', dataAquisicao: '2019-01-01', titular: 'parte_a', clausulaIncomunicabilidade: true },
      regimeBens, marcos: marcosPadrao,
    })
    expect(r).toMatchObject({ classificacao: 'particular', regra: 'CC, art. 1.668, I' })
  })

  it('sub-rogação → particular (art. 1.668, I)', () => {
    const r = classificarBem({
      bem: { formaAquisicao: 'sub_rogacao', dataAquisicao: '2019-01-01', titular: 'parte_a', clausulaIncomunicabilidade: false },
      regimeBens, marcos: marcosPadrao,
    })
    expect(r).toMatchObject({ classificacao: 'particular', regra: 'CC, art. 1.668, I' })
  })

  it('bem de uso pessoal → particular (art. 1.668, V)', () => {
    const r = classificarBem({
      bem: { formaAquisicao: 'beneficiaria_particular', dataAquisicao: '2019-01-01', titular: 'parte_a', clausulaIncomunicabilidade: false },
      regimeBens, marcos: marcosPadrao,
    })
    expect(r).toMatchObject({ classificacao: 'particular', regra: 'CC, art. 1.668, V' })
  })
})

describe('classificarBem — separação total', () => {
  const regimeBens = 'separacao_total'

  it('titular ambos → comunicável, condomínio (art. 1.687)', () => {
    const r = classificarBem({
      bem: { formaAquisicao: 'oneroso', dataAquisicao: '2019-01-01', titular: 'ambos' },
      regimeBens, marcos: marcosPadrao,
    })
    expect(r).toMatchObject({ classificacao: 'comunicavel', regra: 'CC, art. 1.687 (condomínio, CC art. 1.314)' })
  })

  it('titular único → particular (art. 1.687)', () => {
    const r = classificarBem({
      bem: { formaAquisicao: 'oneroso', dataAquisicao: '2019-01-01', titular: 'parte_a' },
      regimeBens, marcos: marcosPadrao,
    })
    expect(r).toMatchObject({ classificacao: 'particular', regra: 'CC, art. 1.687' })
  })
})

describe('classificarBem — participação final nos aquestos', () => {
  const regimeBens = 'participacao_final_aquestos'

  it('oneroso na constância, titular parte_a → aquesto_a', () => {
    const r = classificarBem({
      bem: { formaAquisicao: 'oneroso', dataAquisicao: '2019-01-01', titular: 'parte_a' },
      regimeBens, marcos: marcosPadrao,
    })
    expect(r).toMatchObject({ classificacao: 'aquesto_a', regra: 'CC, art. 1.674 (aquestos)' })
  })

  it('oneroso na constância, titular parte_b → aquesto_b', () => {
    const r = classificarBem({
      bem: { formaAquisicao: 'oneroso', dataAquisicao: '2019-01-01', titular: 'parte_b' },
      regimeBens, marcos: marcosPadrao,
    })
    expect(r.classificacao).toBe('aquesto_b')
  })

  it('anterior ao casamento → fora_aquestos (art. 1.674, I)', () => {
    const r = classificarBem({
      bem: { formaAquisicao: 'oneroso', dataAquisicao: '2010-01-01', titular: 'parte_a' },
      regimeBens, marcos: marcosPadrao,
    })
    expect(r).toMatchObject({ classificacao: 'fora_aquestos', regra: 'CC, art. 1.674, I' })
  })

  it('herança/doação/legado → fora_aquestos (art. 1.674, II)', () => {
    const r = classificarBem({
      bem: { formaAquisicao: 'heranca', dataAquisicao: '2019-01-01', titular: 'parte_a' },
      regimeBens, marcos: marcosPadrao,
    })
    expect(r).toMatchObject({ classificacao: 'fora_aquestos', regra: 'CC, art. 1.674, II' })
  })

  it('sub-rogação → fora_aquestos (art. 1.674, I)', () => {
    const r = classificarBem({
      bem: { formaAquisicao: 'sub_rogacao', dataAquisicao: '2019-01-01', titular: 'parte_a' },
      regimeBens, marcos: marcosPadrao,
    })
    expect(r).toMatchObject({ classificacao: 'fora_aquestos' })
  })

  it('titular ambos, oneroso na constância → fora_aquestos com regra específica', () => {
    const r = classificarBem({
      bem: { formaAquisicao: 'oneroso', dataAquisicao: '2019-01-01', titular: 'ambos' },
      regimeBens, marcos: marcosPadrao,
    })
    expect(r.classificacao).toBe('fora_aquestos')
    expect(r.regra).toContain('ambos')
  })

  it('oneroso sem data → pendente', () => {
    const r = classificarBem({
      bem: { formaAquisicao: 'oneroso', dataAquisicao: null, titular: 'parte_a' },
      regimeBens, marcos: marcosPadrao,
    })
    expect(r).toMatchObject({ classificacao: 'pendente', campoFaltante: 'dataAquisicao' })
  })
})
