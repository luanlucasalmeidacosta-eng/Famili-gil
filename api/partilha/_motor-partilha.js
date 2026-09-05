// api/partilha/_motor-partilha.js
//
// Motor de Partilha de Bens. REGRA + ARITMÉTICA PURAS: sem rede (a Partilha
// não usa o BCB — valores de bens são informados pelo advogado), sem IA, sem
// relógio, sem aleatoriedade. Decomposto em funções pequenas e compostas:
// classificarBem -> apurarAcervo -> calcularQuinhoes -> sinalizarTributario
// -> calcularPartilha (orquestrador).
//
// Isolamento: este arquivo NUNCA importa de api/pensao/*.

import { arredonda2 } from '../_core/dinheiro.js'

const SENTINELA_SEM_FIM = '9999-12-31' // "constância" sem marco de fim informado

function fimConstancia(marcos) {
  if (marcos.separacaoFatoEfeito === 'corta_comunicacao') {
    return marcos.dataSeparacaoFato ?? marcos.dataAjuizamento ?? SENTINELA_SEM_FIM
  }
  return marcos.dataAjuizamento ?? SENTINELA_SEM_FIM
}

function naConstancia(dataAquisicao, marcos) {
  if (!dataAquisicao) return false
  return dataAquisicao >= marcos.dataCasamento && dataAquisicao < fimConstancia(marcos)
}

function classificarComunhaoParcial(bem, marcos) {
  const { formaAquisicao, dataAquisicao, titular } = bem

  if (dataAquisicao && dataAquisicao < marcos.dataCasamento) {
    return { classificacao: 'particular', regra: 'CC, art. 1.659, I / art. 1.661' }
  }
  if (formaAquisicao === 'sub_rogacao') {
    return { classificacao: 'particular', regra: 'CC, art. 1.659, II' }
  }
  if (formaAquisicao === 'beneficiaria_particular') {
    return { classificacao: 'particular', regra: 'CC, art. 1.659, V a VII' }
  }
  if (formaAquisicao === 'doacao' || formaAquisicao === 'heranca' || formaAquisicao === 'legado') {
    return titular === 'ambos'
      ? { classificacao: 'comunicavel', regra: 'CC, art. 1.660, III' }
      : { classificacao: 'particular', regra: 'CC, art. 1.659, I' }
  }
  if (formaAquisicao === 'fato_eventual' && naConstancia(dataAquisicao, marcos)) {
    return { classificacao: 'comunicavel', regra: 'CC, art. 1.660, II' }
  }
  if (formaAquisicao === 'oneroso' && naConstancia(dataAquisicao, marcos)) {
    return { classificacao: 'comunicavel', regra: 'CC, art. 1.660, I' }
  }
  if (formaAquisicao === 'oneroso' || formaAquisicao === 'fato_eventual') {
    return { classificacao: 'pendente', campoFaltante: 'dataAquisicao' }
  }
  return { classificacao: 'pendente', campoFaltante: 'formaAquisicao' }
}

function classificarComunhaoUniversal(bem) {
  const { formaAquisicao, clausulaIncomunicabilidade } = bem
  if (clausulaIncomunicabilidade || formaAquisicao === 'sub_rogacao') {
    return { classificacao: 'particular', regra: 'CC, art. 1.668, I' }
  }
  if (formaAquisicao === 'beneficiaria_particular') {
    return { classificacao: 'particular', regra: 'CC, art. 1.668, V' }
  }
  return { classificacao: 'comunicavel', regra: 'CC, art. 1.667' }
}

function classificarSeparacaoTotal(bem) {
  return bem.titular === 'ambos'
    ? { classificacao: 'comunicavel', regra: 'CC, art. 1.687 (condomínio, CC art. 1.314)' }
    : { classificacao: 'particular', regra: 'CC, art. 1.687' }
}

function classificarParticipacaoFinal(bem, marcos) {
  const { formaAquisicao, dataAquisicao, titular } = bem

  if (dataAquisicao && dataAquisicao < marcos.dataCasamento) {
    return { classificacao: 'fora_aquestos', regra: 'CC, art. 1.674, I' }
  }
  if (formaAquisicao === 'sub_rogacao') {
    return { classificacao: 'fora_aquestos', regra: 'CC, art. 1.674, I' }
  }
  if (formaAquisicao === 'doacao' || formaAquisicao === 'heranca' || formaAquisicao === 'legado') {
    return { classificacao: 'fora_aquestos', regra: 'CC, art. 1.674, II' }
  }
  if (formaAquisicao === 'beneficiaria_particular') {
    return { classificacao: 'fora_aquestos', regra: 'CC, art. 1.674, II' }
  }
  if (formaAquisicao === 'oneroso' && naConstancia(dataAquisicao, marcos)) {
    if (titular === 'ambos') {
      return {
        classificacao: 'fora_aquestos',
        regra: 'CC, art. 1.674 (bem em nome de ambos tratado fora dos aquestos individuais — ver alerta)',
      }
    }
    return {
      classificacao: titular === 'parte_a' ? 'aquesto_a' : 'aquesto_b',
      regra: 'CC, art. 1.674 (aquestos)',
    }
  }
  if (formaAquisicao === 'oneroso') {
    return { classificacao: 'pendente', campoFaltante: 'dataAquisicao' }
  }
  return { classificacao: 'pendente', campoFaltante: 'formaAquisicao' }
}

/**
 * @returns {{classificacao:'comunicavel'|'particular'|'pendente', regra:string,
 *   citacao:string, origem:'automatica'|'override'|'pendente', campoFaltante?:string}}
 */
export function classificarBem({ bem, regimeBens, marcos }) {
  if (bem.classificacaoOverride) {
    return {
      classificacao: bem.classificacaoOverride,
      regra: 'reclassificação manual',
      citacao: 'ajuste do advogado',
      origem: 'override',
    }
  }
  if (!bem.formaAquisicao) {
    return { classificacao: 'pendente', regra: '—', citacao: '—', origem: 'pendente', campoFaltante: 'formaAquisicao' }
  }

  let resultado
  if (regimeBens === 'comunhao_parcial') {
    resultado = classificarComunhaoParcial(bem, marcos)
  } else if (regimeBens === 'comunhao_universal') {
    resultado = classificarComunhaoUniversal(bem)
  } else if (regimeBens === 'separacao_total') {
    resultado = classificarSeparacaoTotal(bem)
  } else if (regimeBens === 'participacao_final_aquestos') {
    resultado = classificarParticipacaoFinal(bem, marcos)
  } else {
    throw new Error(`regimeBens inválido: ${regimeBens}`)
  }

  if (resultado.classificacao === 'pendente') {
    return { classificacao: 'pendente', regra: '—', citacao: '—', origem: 'pendente', campoFaltante: resultado.campoFaltante }
  }
  return { ...resultado, citacao: resultado.regra, origem: 'automatica' }
}

function passivoDedutivelComum(passivo, regimeBens, linhasBens) {
  const bemVinculado = passivo.bemVinculadoId ? linhasBens.find((l) => l.bemId === passivo.bemVinculadoId) : null
  if (regimeBens === 'comunhao_parcial') {
    if (passivo.natureza !== 'constancia_proveito_comum' && passivo.natureza !== 'tributo_de_bem') return false
    if (bemVinculado && bemVinculado.classificacao !== 'comunicavel') return false
    return true
  }
  if (regimeBens === 'comunhao_universal') {
    return passivo.natureza !== 'anterior_casamento'
  }
  if (regimeBens === 'separacao_total') {
    return !!bemVinculado && bemVinculado.classificacao === 'comunicavel'
  }
  return false // participacao_final_aquestos não usa este caminho
}

function calcularIntervalo(dataAquisicao, marcos) {
  if (!dataAquisicao) return null
  if (dataAquisicao < marcos.dataCasamento) return 'antes_casamento'
  if (dataAquisicao < fimConstancia(marcos)) return 'constancia'
  return 'apos_fim_constancia'
}

/**
 * @returns {{linhasBens: Array, totaisAcervo: {acervoBruto:number,passivosDedutiveis:number,acervoLiquido:number},
 *   aquestos: {a:number,b:number}|null, linhaTempo: Array, alertas: string[]}}
 */
export function apurarAcervo({ bens, passivos, regimeBens, marcos }) {
  const ehParticipacaoFinal = regimeBens === 'participacao_final_aquestos'
  const alertas = []

  const linhasBens = bens.map((bem) => {
    const c = classificarBem({ bem, regimeBens, marcos })
    const valorLiquido = arredonda2(bem.valorMercado - (bem.financiado ? bem.saldoDevedor || 0 : 0))
    if (c.classificacao === 'pendente') {
      alertas.push(`Bem "${bem.descricao}" está pendente — falta informar ${c.campoFaltante}.`)
    }
    return {
      bemId: bem.id, descricao: bem.descricao, tipo: bem.tipo, valorMercado: arredonda2(bem.valorMercado),
      financiado: !!bem.financiado, saldoDevedor: bem.saldoDevedor ?? null, valorLiquido,
      classificacao: c.classificacao, regra: c.regra, citacao: c.citacao, origem: c.origem,
      campoFaltante: c.campoFaltante, intervaloAquisicao: calcularIntervalo(bem.dataAquisicao, marcos),
    }
  })

  // incoerência: oneroso/fato_eventual na constância mas saiu particular sem override
  for (const bem of bens) {
    const linha = linhasBens.find((l) => l.bemId === bem.id)
    const naConstanciaTempo = linha.intervaloAquisicao === 'constancia'
    const formaComunicavel = bem.formaAquisicao === 'oneroso' || bem.formaAquisicao === 'fato_eventual'
    if (naConstanciaTempo && formaComunicavel && linha.classificacao === 'particular' && linha.origem !== 'override') {
      alertas.push(`Bem "${bem.descricao}" foi adquirido durante a constância mas saiu particular — confira a classificação.`)
    }
  }

  // separação de fato — corta_comunicacao: override comunicável após o corte gera alerta
  if (marcos.separacaoFatoEfeito === 'corta_comunicacao' && marcos.dataSeparacaoFato) {
    for (const bem of bens) {
      const linha = linhasBens.find((l) => l.bemId === bem.id)
      const comunicavelOuAquesto = linha.classificacao === 'comunicavel' || linha.classificacao?.startsWith('aquesto')
      if (linha.intervaloAquisicao === 'apos_fim_constancia' && linha.origem === 'override' && comunicavelOuAquesto) {
        alertas.push(`Bem "${bem.descricao}" foi marcado comunicável mesmo adquirido após a separação de fato (override manual) — confira.`)
      }
    }
  }
  // separação de fato — apenas_alerta: todo bem cuja dataAquisicao cai na janela
  // [dataSeparacaoFato, dataAjuizamento/sentinela) gera aviso, sempre — mesmo limite
  // superior exclusivo usado em naConstancia/fimConstancia, pra manter o mesmo estilo
  // de comparação lexicográfica de datas ISO do resto do arquivo.
  if (marcos.separacaoFatoEfeito === 'apenas_alerta' && marcos.dataSeparacaoFato) {
    const limiteSuperior = marcos.dataAjuizamento ?? SENTINELA_SEM_FIM
    for (const bem of bens) {
      if (bem.dataAquisicao && bem.dataAquisicao >= marcos.dataSeparacaoFato && bem.dataAquisicao < limiteSuperior) {
        alertas.push(`Bem "${bem.descricao}" adquirido após a separação de fato — verifique se deve integrar a partilha.`)
      }
    }
  }

  let acervoBruto = 0
  let passivosDedutiveis = 0
  let aquestos = null

  if (ehParticipacaoFinal) {
    let a = 0
    let b = 0
    for (const linha of linhasBens) {
      if (linha.classificacao === 'aquesto_a') a += linha.valorLiquido
      if (linha.classificacao === 'aquesto_b') b += linha.valorLiquido
    }
    for (const passivo of passivos) {
      if (passivo.natureza === 'anterior_casamento' || passivo.natureza === 'ato_ilicito') continue
      if (passivo.responsavel === 'parte_a') a -= passivo.valor
      else if (passivo.responsavel === 'parte_b') b -= passivo.valor
      else { a -= passivo.valor / 2; b -= passivo.valor / 2 }
    }
    aquestos = { a: arredonda2(a), b: arredonda2(b) }
  } else {
    acervoBruto = arredonda2(linhasBens
      .filter((l) => l.classificacao === 'comunicavel')
      .reduce((s, l) => s + l.valorMercado, 0))
    passivosDedutiveis = arredonda2(passivos
      .filter((p) => passivoDedutivelComum(p, regimeBens, linhasBens))
      .reduce((s, p) => s + p.valor, 0))
  }

  const fim = fimConstancia(marcos)
  const bensNoIntervalo = (nome) => linhasBens.filter((l) => l.intervaloAquisicao === nome).map((l) => l.bemId)
  const linhaTempo = [
    {
      intervalo: 'antes_casamento', de: null, ate: marcos.dataCasamento,
      regraComunicacao: 'Bens anteriores ao casamento são particulares (exceto no regime de comunhão universal, salvo cláusula).',
      bensNoIntervalo: bensNoIntervalo('antes_casamento'), alertas: [],
    },
    {
      intervalo: 'constancia', de: marcos.dataCasamento, ate: fim === SENTINELA_SEM_FIM ? null : fim,
      regraComunicacao: 'Bens adquiridos durante a constância seguem a regra do regime de bens.',
      bensNoIntervalo: bensNoIntervalo('constancia'), alertas: [],
    },
  ]
  if (fim !== SENTINELA_SEM_FIM) {
    linhaTempo.push({
      intervalo: 'apos_fim_constancia', de: fim, ate: null,
      regraComunicacao: marcos.separacaoFatoEfeito === 'corta_comunicacao'
        ? 'Bens adquiridos após a separação de fato não se comunicam (salvo reclassificação manual).'
        : 'Bens adquiridos após a separação de fato entram no acervo pela regra normal, mas são sinalizados para revisão.',
      bensNoIntervalo: bensNoIntervalo('apos_fim_constancia'), alertas: [],
    })
  }

  return {
    linhasBens,
    totaisAcervo: {
      acervoBruto, passivosDedutiveis,
      acervoLiquido: arredonda2(acervoBruto - passivosDedutiveis),
    },
    aquestos, linhaTempo, alertas,
  }
}

function passivoAtribuidoAparte(passivo, parte, regimeBens, linhasBens) {
  if (!passivoDedutivelComum(passivo, regimeBens, linhasBens)) return 0
  if (passivo.responsavel === parte) return passivo.valor
  if (passivo.responsavel === 'ambos') return passivo.valor / 2
  return 0
}

/**
 * @returns {{linhasBens: Array, quadroQuinhoes: object, alertas: string[]}}
 */
export function calcularQuinhoes({ regimeBens, linhasBens, totaisAcervo, aquestos, passivos, cenario }) {
  const alertas = []

  if (regimeBens === 'participacao_final_aquestos') {
    if (cenario.pctParteA !== 50) {
      alertas.push(`pctParteA = ${cenario.pctParteA}% é ignorado no regime de participação final nos aquestos (usa crédito de compensação).`)
    }
    const creditoAcontraB = arredonda2(0.5 * aquestos.b)
    const creditoBcontraA = arredonda2(0.5 * aquestos.a)
    const saldo = arredonda2(creditoAcontraB - creditoBcontraA)
    const linhasSemAlocacao = linhasBens.map((l) => ({ ...l, alocadoPara: null, quinhaoValor: 0 }))
    return {
      linhasBens: linhasSemAlocacao,
      quadroQuinhoes: {
        parteA: { acervoLiquido: aquestos.a, quinhaoIdealPct: null, quinhaoIdealValor: null, valorAlocado: aquestos.a, torna: saldo },
        parteB: { acervoLiquido: aquestos.b, quinhaoIdealPct: null, quinhaoIdealValor: null, valorAlocado: aquestos.b, torna: -saldo },
      },
      alertas,
    }
  }

  const mapaAlocacao = new Map((cenario.alocacoes || []).map((a) => [a.bemId, a]))
  let valorAlocadoA = 0
  let valorAlocadoB = 0

  const linhasComAlocacao = linhasBens.map((linha) => {
    if (linha.classificacao !== 'comunicavel') {
      return { ...linha, alocadoPara: null, quinhaoValor: 0 }
    }
    const aloc = mapaAlocacao.get(linha.bemId)
    if (!aloc) {
      alertas.push(`Bem "${linha.descricao}" está comunicável mas não foi alocado neste cenário.`)
      return { ...linha, alocadoPara: null, quinhaoValor: 0 }
    }
    if (aloc.para === 'condominio') {
      const fracaoA = aloc.fracaoA ?? 0.5
      const valorA = arredonda2(linha.valorLiquido * fracaoA)
      const valorB = arredonda2(linha.valorLiquido - valorA)
      valorAlocadoA += valorA
      valorAlocadoB += valorB
      return { ...linha, alocadoPara: 'condominio', quinhaoValor: linha.valorLiquido }
    }
    if (aloc.para === 'parte_a') valorAlocadoA += linha.valorLiquido
    else valorAlocadoB += linha.valorLiquido
    return { ...linha, alocadoPara: aloc.para, quinhaoValor: linha.valorLiquido }
  })

  for (const passivo of passivos) {
    valorAlocadoA -= passivoAtribuidoAparte(passivo, 'parte_a', regimeBens, linhasBens)
    valorAlocadoB -= passivoAtribuidoAparte(passivo, 'parte_b', regimeBens, linhasBens)
  }
  valorAlocadoA = arredonda2(valorAlocadoA)
  valorAlocadoB = arredonda2(valorAlocadoB)

  const quinhaoIdealA = arredonda2((cenario.pctParteA / 100) * totaisAcervo.acervoLiquido)
  const quinhaoIdealB = arredonda2(totaisAcervo.acervoLiquido - quinhaoIdealA)
  const tornaA = arredonda2(valorAlocadoA - quinhaoIdealA)
  const tornaB = arredonda2(valorAlocadoB - quinhaoIdealB)

  const tornaInformadaLiquida = arredonda2((cenario.tornas || []).reduce((s, t) => {
    if (t.de === 'parte_a' && t.para === 'parte_b') return s + t.valor
    if (t.de === 'parte_b' && t.para === 'parte_a') return s - t.valor
    return s
  }, 0))
  if (Math.abs(tornaInformadaLiquida - tornaA) > 0.01) {
    alertas.push(`A torna calculada (R$ ${tornaA.toFixed(2)}) diverge da informada no cenário (R$ ${tornaInformadaLiquida.toFixed(2)}).`)
  }

  return {
    linhasBens: linhasComAlocacao,
    quadroQuinhoes: {
      parteA: { acervoLiquido: totaisAcervo.acervoLiquido, quinhaoIdealPct: cenario.pctParteA, quinhaoIdealValor: quinhaoIdealA, valorAlocado: valorAlocadoA, torna: tornaA },
      parteB: { acervoLiquido: totaisAcervo.acervoLiquido, quinhaoIdealPct: 100 - cenario.pctParteA, quinhaoIdealValor: quinhaoIdealB, valorAlocado: valorAlocadoB, torna: tornaB },
    },
    alertas,
  }
}

/**
 * @returns {Array<{tipo:'ITBI'|'ITCMD', base:number, fundamento:string}>}
 */
export function sinalizarTributario({ quadroQuinhoes, cenario }) {
  const excesso = Math.abs(quadroQuinhoes.parteA.torna)
  if (excesso <= 0.01) return []

  const tornaOnerosaInformada = (cenario.tornas || [])
    .filter((t) => t.forma === 'dinheiro' || t.forma === 'bem')
    .reduce((s, t) => s + t.valor, 0)

  const alertasTributarios = []
  const baseItbi = Math.min(excesso, tornaOnerosaInformada)
  if (baseItbi > 0.01) {
    alertasTributarios.push({
      tipo: 'ITBI', base: arredonda2(baseItbi),
      fundamento: 'Súmula 116 do STF — legítima a cobrança de imposto de reposição quando há desigualdade nos valores partilhados; incidência sobre a torna dentro do limite da meação.',
    })
  }
  const baseItcmd = excesso - baseItbi
  if (baseItcmd > 0.01) {
    alertasTributarios.push({
      tipo: 'ITCMD', base: arredonda2(baseItcmd),
      fundamento: 'Excesso de meação sem contrapartida onerosa caracteriza doação — distinção jurisprudencial ITBI × ITCMD no excesso de meação.',
    })
  }
  return alertasTributarios
}

/**
 * Orquestrador: compõe apurarAcervo -> calcularQuinhoes -> sinalizarTributario.
 * @returns {{linhasBens: Array, quadroQuinhoes: object, linhaTempo: Array,
 *   alertasTributarios: Array, totais: object, alertas: string[]}}
 */
export function calcularPartilha({ regimeBens, marcos, bens, passivos, cenario }) {
  const acervo = apurarAcervo({ bens, passivos, regimeBens, marcos })
  const quinhoes = calcularQuinhoes({
    regimeBens, linhasBens: acervo.linhasBens, totaisAcervo: acervo.totaisAcervo,
    aquestos: acervo.aquestos, passivos, cenario,
  })
  const alertasTributarios = sinalizarTributario({ quadroQuinhoes: quinhoes.quadroQuinhoes, cenario })
  const somaTornas = arredonda2((cenario.tornas || []).reduce((s, t) => s + t.valor, 0))

  return {
    linhasBens: quinhoes.linhasBens,
    quadroQuinhoes: quinhoes.quadroQuinhoes,
    linhaTempo: acervo.linhaTempo,
    alertasTributarios,
    totais: { ...acervo.totaisAcervo, somaTornas },
    alertas: [...acervo.alertas, ...quinhoes.alertas],
  }
}
