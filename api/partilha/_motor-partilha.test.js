import { describe, it, expect } from 'vitest'
import { classificarBem, apurarAcervo, calcularQuinhoes, sinalizarTributario } from './_motor-partilha.js'

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

const marcosComSeparacao = {
  dataCasamento: '2015-01-01', dataSeparacaoFato: '2022-06-01', separacaoFatoEfeito: 'corta_comunicacao',
}

describe('apurarAcervo — comunhão parcial', () => {
  const bens = [
    { id: 'b1', descricao: 'Apartamento', tipo: 'imovel', valorMercado: 500000, dataAquisicao: '2018-01-01', formaAquisicao: 'oneroso', titular: 'parte_a', financiado: true, saldoDevedor: 100000 },
    { id: 'b2', descricao: 'Carro herdado', tipo: 'veiculo', valorMercado: 80000, dataAquisicao: '2019-01-01', formaAquisicao: 'heranca', titular: 'parte_b', financiado: false },
    { id: 'b3', descricao: 'Bem sem forma informada', tipo: 'outro', valorMercado: 10000, dataAquisicao: null, formaAquisicao: null, titular: 'parte_a', financiado: false },
  ]
  const passivos = [
    { id: 'p1', valor: 20000, natureza: 'constancia_proveito_comum', responsavel: 'ambos', bemVinculadoId: null },
    { id: 'p2', valor: 5000, natureza: 'anterior_casamento', responsavel: 'parte_a', bemVinculadoId: null },
  ]

  it('acervo bruto só com o comunicável; líquido desconta financiamento e passivos dedutíveis', () => {
    const r = apurarAcervo({ bens, passivos, regimeBens: 'comunhao_parcial', marcos: marcosComSeparacao })
    // só b1 é comunicável (oneroso na constância); b2 é herança pra um só (particular); b3 é pendente
    expect(r.totaisAcervo.acervoBruto).toBe(500000)
    expect(r.totaisAcervo.passivosDedutiveis).toBe(20000) // só p1 (proveito comum); p2 é anterior ao casamento
    // acervoLiquido parte do valorLiquido dos comunicáveis (mesma base da alocação
    // em calcularQuinhoes): 400000 (500000 - 100000 de saldo devedor) - 20000 de passivo
    expect(r.totaisAcervo.acervoLiquido).toBe(380000)
    expect(r.linhasBens.find((l) => l.bemId === 'b1').valorLiquido).toBe(400000) // 500000 - 100000 financiado
  })

  it('bem pendente gera alerta com o campo faltante', () => {
    const r = apurarAcervo({ bens, passivos, regimeBens: 'comunhao_parcial', marcos: marcosComSeparacao })
    expect(r.alertas.some((a) => a.includes('Bem sem forma informada') && a.includes('formaAquisicao'))).toBe(true)
  })

  it('aquestos é null fora da participação final', () => {
    const r = apurarAcervo({ bens, passivos, regimeBens: 'comunhao_parcial', marcos: marcosComSeparacao })
    expect(r.aquestos).toBeNull()
  })

  it('linha do tempo tem os 3 intervalos quando há separação de fato', () => {
    const r = apurarAcervo({ bens, passivos, regimeBens: 'comunhao_parcial', marcos: marcosComSeparacao })
    expect(r.linhaTempo.map((t) => t.intervalo)).toEqual(['antes_casamento', 'constancia', 'apos_fim_constancia'])
  })

  it('sem separação de fato nem ajuizamento → só 2 intervalos (constância fica em aberto)', () => {
    const r = apurarAcervo({
      bens, passivos, regimeBens: 'comunhao_parcial',
      marcos: { dataCasamento: '2015-01-01', dataSeparacaoFato: null, separacaoFatoEfeito: 'corta_comunicacao' },
    })
    expect(r.linhaTempo.map((t) => t.intervalo)).toEqual(['antes_casamento', 'constancia'])
  })
})

describe('apurarAcervo — separação de fato, modo apenas_alerta', () => {
  it('bem adquirido depois da separação de fato entra no acervo, mas gera alerta', () => {
    const bens = [
      { id: 'b1', descricao: 'Terreno pós-separação', tipo: 'imovel', valorMercado: 100000, dataAquisicao: '2023-01-01', formaAquisicao: 'oneroso', titular: 'parte_a', financiado: false },
    ]
    const r = apurarAcervo({
      bens, passivos: [], regimeBens: 'comunhao_parcial',
      marcos: { dataCasamento: '2015-01-01', dataSeparacaoFato: '2022-06-01', dataAjuizamento: '2024-01-01', separacaoFatoEfeito: 'apenas_alerta' },
    })
    expect(r.linhasBens[0].classificacao).toBe('comunicavel') // entra normalmente
    expect(r.alertas.some((a) => a.includes('após a separação de fato'))).toBe(true)
  })

  it('bem adquirido além do ajuizamento fica fora da janela — não gera o alerta', () => {
    const bens = [
      { id: 'b1', descricao: 'Terreno pós-ajuizamento', tipo: 'imovel', valorMercado: 100000, dataAquisicao: '2024-06-01', formaAquisicao: 'oneroso', titular: 'parte_a', financiado: false },
    ]
    const r = apurarAcervo({
      bens, passivos: [], regimeBens: 'comunhao_parcial',
      marcos: { dataCasamento: '2015-01-01', dataSeparacaoFato: '2022-06-01', dataAjuizamento: '2024-01-01', separacaoFatoEfeito: 'apenas_alerta' },
    })
    expect(r.alertas.some((a) => a.includes('após a separação de fato'))).toBe(false)
  })
})

describe('apurarAcervo — participação final nos aquestos', () => {
  it('calcula aquestos de A e B líquidos de passivos', () => {
    const bens = [
      { id: 'b1', descricao: 'Loja de A', tipo: 'empresa', valorMercado: 300000, dataAquisicao: '2018-01-01', formaAquisicao: 'oneroso', titular: 'parte_a', financiado: false },
      { id: 'b2', descricao: 'Apê de B', tipo: 'imovel', valorMercado: 200000, dataAquisicao: '2019-01-01', formaAquisicao: 'oneroso', titular: 'parte_b', financiado: false },
    ]
    const passivos = [{ id: 'p1', valor: 50000, natureza: 'constancia_particular', responsavel: 'parte_a', bemVinculadoId: null }]
    const r = apurarAcervo({ bens, passivos, regimeBens: 'participacao_final_aquestos', marcos: marcosComSeparacao })
    expect(r.aquestos).toEqual({ a: 250000, b: 200000 })
  })

  it('totaisAcervo não fica zerado: soma dos dois aquestos (não some no export)', () => {
    const bens = [
      { id: 'b1', descricao: 'Loja de A', tipo: 'empresa', valorMercado: 300000, dataAquisicao: '2018-01-01', formaAquisicao: 'oneroso', titular: 'parte_a', financiado: false },
      { id: 'b2', descricao: 'Apê de B', tipo: 'imovel', valorMercado: 200000, dataAquisicao: '2019-01-01', formaAquisicao: 'oneroso', titular: 'parte_b', financiado: false },
    ]
    const passivos = [{ id: 'p1', valor: 50000, natureza: 'constancia_particular', responsavel: 'parte_a', bemVinculadoId: null }]
    const r = apurarAcervo({ bens, passivos, regimeBens: 'participacao_final_aquestos', marcos: marcosComSeparacao })
    expect(r.totaisAcervo).toEqual({ acervoBruto: 450000, passivosDedutiveis: 0, acervoLiquido: 450000 })
  })
})

describe('calcularQuinhoes — comunhão parcial, 50/50', () => {
  const linhasBens = [
    { bemId: 'b1', descricao: 'Casa', valorLiquido: 400000, classificacao: 'comunicavel' },
    { bemId: 'b2', descricao: 'Carro', valorLiquido: 80000, classificacao: 'particular' },
  ]
  const totaisAcervo = { acervoBruto: 400000, passivosDedutiveis: 0, acervoLiquido: 400000 }

  it('bem alocado integralmente pra uma parte gera torna pra equilibrar', () => {
    const r = calcularQuinhoes({
      regimeBens: 'comunhao_parcial', linhasBens, totaisAcervo, aquestos: null, passivos: [],
      cenario: { pctParteA: 50, alocacoes: [{ bemId: 'b1', para: 'parte_a' }], tornas: [] },
    })
    expect(r.quadroQuinhoes.parteA).toMatchObject({ acervoLiquido: 400000, quinhaoIdealValor: 200000, valorAlocado: 400000, torna: 200000 })
    expect(r.quadroQuinhoes.parteB).toMatchObject({ quinhaoIdealValor: 200000, valorAlocado: 0, torna: -200000 })
    expect(r.linhasBens.find((l) => l.bemId === 'b1')).toMatchObject({ alocadoPara: 'parte_a', quinhaoValor: 400000 })
  })

  it('bem comunicável sem alocação no cenário gera alerta', () => {
    const r = calcularQuinhoes({
      regimeBens: 'comunhao_parcial', linhasBens, totaisAcervo, aquestos: null, passivos: [],
      cenario: { pctParteA: 50, alocacoes: [], tornas: [] },
    })
    expect(r.alertas.some((a) => a.includes('não foi alocado'))).toBe(true)
  })

  it('condomínio sem fracaoA assume 50/50', () => {
    const r = calcularQuinhoes({
      regimeBens: 'comunhao_parcial', linhasBens, totaisAcervo, aquestos: null, passivos: [],
      cenario: { pctParteA: 50, alocacoes: [{ bemId: 'b1', para: 'condominio' }], tornas: [] },
    })
    expect(r.quadroQuinhoes.parteA.valorAlocado).toBe(200000)
    expect(r.quadroQuinhoes.parteB.valorAlocado).toBe(200000)
  })

  it('percentual livre (60/40) muda o quinhão ideal', () => {
    const r = calcularQuinhoes({
      regimeBens: 'comunhao_parcial', linhasBens, totaisAcervo, aquestos: null, passivos: [],
      cenario: { pctParteA: 60, alocacoes: [{ bemId: 'b1', para: 'parte_a' }], tornas: [] },
    })
    expect(r.quadroQuinhoes.parteA.quinhaoIdealValor).toBe(240000)
    expect(r.quadroQuinhoes.parteA.torna).toBe(160000) // 400000 - 240000
  })

  it('divergência entre torna calculada e informada gera alerta', () => {
    const r = calcularQuinhoes({
      regimeBens: 'comunhao_parcial', linhasBens, totaisAcervo, aquestos: null, passivos: [],
      cenario: { pctParteA: 50, alocacoes: [{ bemId: 'b1', para: 'parte_a' }], tornas: [{ de: 'parte_a', para: 'parte_b', valor: 50000, forma: 'dinheiro' }] },
    })
    expect(r.alertas.some((a) => a.includes('diverge'))).toBe(true)
  })
})

describe('calcularQuinhoes — participação final nos aquestos', () => {
  it('crédito de compensação, ignora pctParteA', () => {
    const r = calcularQuinhoes({
      regimeBens: 'participacao_final_aquestos', linhasBens: [], totaisAcervo: { acervoBruto: 0, passivosDedutiveis: 0, acervoLiquido: 0 },
      aquestos: { a: 250000, b: 200000 }, passivos: [],
      cenario: { pctParteA: 50, alocacoes: [], tornas: [] },
    })
    // creditoAcontraB = 0.5*200000=100000; creditoBcontraA = 0.5*250000=125000; saldo = 100000-125000 = -25000
    expect(r.quadroQuinhoes.parteA.torna).toBe(-25000)
    expect(r.quadroQuinhoes.parteB.torna).toBe(25000)
  })

  it('pctParteA != 50 nesse regime gera alerta (é ignorado no cálculo)', () => {
    const r = calcularQuinhoes({
      regimeBens: 'participacao_final_aquestos', linhasBens: [], totaisAcervo: { acervoBruto: 0, passivosDedutiveis: 0, acervoLiquido: 0 },
      aquestos: { a: 100000, b: 100000 }, passivos: [],
      cenario: { pctParteA: 70, alocacoes: [], tornas: [] },
    })
    expect(r.alertas.some((a) => a.includes('participação final'))).toBe(true)
  })
})

describe('sinalizarTributario', () => {
  it('sem excesso → nenhum alerta', () => {
    const r = sinalizarTributario({
      quadroQuinhoes: { parteA: { torna: 0 }, parteB: { torna: 0 } },
      cenario: { tornas: [] },
    })
    expect(r).toEqual([])
  })

  it('excesso todo coberto por torna em dinheiro → só ITBI', () => {
    const r = sinalizarTributario({
      quadroQuinhoes: { parteA: { torna: 200000 }, parteB: { torna: -200000 } },
      cenario: { tornas: [{ de: 'parte_a', para: 'parte_b', valor: 200000, forma: 'dinheiro' }] },
    })
    expect(r).toEqual([{ tipo: 'ITBI', base: 200000, fundamento: expect.stringContaining('Súmula 116') }])
  })

  it('excesso sem nenhuma contrapartida → só ITCMD', () => {
    const r = sinalizarTributario({
      quadroQuinhoes: { parteA: { torna: 200000 }, parteB: { torna: -200000 } },
      cenario: { tornas: [{ de: 'parte_a', para: 'parte_b', valor: 200000, forma: 'sem_contrapartida' }] },
    })
    expect(r).toEqual([{ tipo: 'ITCMD', base: 200000, fundamento: expect.stringContaining('doação') }])
  })

  it('excesso parcialmente coberto → ITBI na parte onerosa e ITCMD no restante', () => {
    const r = sinalizarTributario({
      quadroQuinhoes: { parteA: { torna: 200000 }, parteB: { torna: -200000 } },
      cenario: { tornas: [{ de: 'parte_a', para: 'parte_b', valor: 120000, forma: 'dinheiro' }] },
    })
    expect(r).toEqual([
      { tipo: 'ITBI', base: 120000, fundamento: expect.stringContaining('Súmula 116') },
      { tipo: 'ITCMD', base: 80000, fundamento: expect.stringContaining('doação') },
    ])
  })
})

import { calcularPartilha } from './_motor-partilha.js'

describe('calcularPartilha', () => {
  const entrada = {
    regimeBens: 'comunhao_parcial',
    marcos: { dataCasamento: '2015-01-01', dataSeparacaoFato: null, separacaoFatoEfeito: 'corta_comunicacao' },
    bens: [
      { id: 'b1', descricao: 'Casa', tipo: 'imovel', valorMercado: 400000, dataAquisicao: '2018-01-01', formaAquisicao: 'oneroso', titular: 'parte_a', financiado: false },
    ],
    passivos: [],
    cenario: { pctParteA: 50, alocacoes: [{ bemId: 'b1', para: 'parte_a' }], tornas: [{ de: 'parte_a', para: 'parte_b', valor: 200000, forma: 'dinheiro' }] },
  }

  it('monta o contrato completo: linhasBens, quadroQuinhoes, linhaTempo, alertasTributarios, totais, alertas', () => {
    const r = calcularPartilha(entrada)
    expect(r.linhasBens[0]).toMatchObject({ bemId: 'b1', classificacao: 'comunicavel', alocadoPara: 'parte_a', quinhaoValor: 400000 })
    expect(r.quadroQuinhoes.parteA.torna).toBe(200000)
    expect(r.linhaTempo.length).toBeGreaterThan(0)
    expect(r.alertasTributarios).toEqual([{ tipo: 'ITBI', base: 200000, fundamento: expect.stringContaining('Súmula 116') }])
    expect(r.totais).toEqual({ acervoBruto: 400000, passivosDedutiveis: 0, acervoLiquido: 400000, somaTornas: 200000 })
    expect(r.alertas).toEqual([])
  })

  it('determinístico: dois runs → JSON idêntico', () => {
    expect(JSON.stringify(calcularPartilha(entrada))).toBe(JSON.stringify(calcularPartilha(entrada)))
  })
})

describe('calcularPartilha — bem financiado fecha o balanço das tornas', () => {
  // Cenário real mais comum da partilha: casa financiada alocada a uma das partes.
  // O acervo líquido e a alocação precisam partir da MESMA base (valorLiquido),
  // senão tornaA + tornaB = -Σ(saldoDevedor) em vez de zero.
  const entradaFinanciada = {
    regimeBens: 'comunhao_parcial',
    marcos: { dataCasamento: '2015-01-01', dataSeparacaoFato: null, separacaoFatoEfeito: 'corta_comunicacao' },
    bens: [
      { id: 'b1', descricao: 'Casa financiada', tipo: 'imovel', valorMercado: 500000, dataAquisicao: '2018-01-01', formaAquisicao: 'oneroso', titular: 'parte_a', financiado: true, saldoDevedor: 200000 },
    ],
    passivos: [],
    cenario: { pctParteA: 50, alocacoes: [{ bemId: 'b1', para: 'parte_a' }], tornas: [] },
  }

  it('acervo líquido usa o valor líquido do bem financiado', () => {
    const r = calcularPartilha(entradaFinanciada)
    expect(r.totais.acervoBruto).toBe(500000)
    expect(r.totais.acervoLiquido).toBe(300000) // 500000 - 200000 de saldo devedor
  })

  it('tornaA + tornaB === 0 (o que uma parte recebe a mais a outra recebe a menos)', () => {
    const r = calcularPartilha(entradaFinanciada)
    expect(r.quadroQuinhoes.parteA.torna).toBe(150000)
    expect(r.quadroQuinhoes.parteB.torna).toBe(-150000)
    expect(r.quadroQuinhoes.parteA.torna + r.quadroQuinhoes.parteB.torna).toBe(0)
  })

  it('com passivo dedutível o balanço continua fechando', () => {
    const r = calcularPartilha({
      ...entradaFinanciada,
      passivos: [{ id: 'p1', valor: 40000, natureza: 'constancia_proveito_comum', responsavel: 'ambos', bemVinculadoId: null }],
    })
    // acervoLiquido = 300000 - 40000 = 260000; cada quinhão ideal = 130000
    // alocado A = 300000 - 20000 = 280000; alocado B = 0 - 20000 = -20000
    expect(r.totais.acervoLiquido).toBe(260000)
    expect(r.quadroQuinhoes.parteA.torna).toBe(150000)
    expect(r.quadroQuinhoes.parteB.torna).toBe(-150000)
    expect(r.quadroQuinhoes.parteA.torna + r.quadroQuinhoes.parteB.torna).toBe(0)
  })
})
