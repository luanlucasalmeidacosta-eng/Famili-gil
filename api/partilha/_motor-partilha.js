// api/partilha/_motor-partilha.js
//
// Motor de Partilha de Bens. REGRA + ARITMÉTICA PURAS: sem rede (a Partilha
// não usa o BCB — valores de bens são informados pelo advogado), sem IA, sem
// relógio, sem aleatoriedade. Decomposto em funções pequenas e compostas:
// classificarBem -> apurarAcervo -> calcularQuinhoes -> sinalizarTributario
// -> calcularPartilha (orquestrador).
//
// Isolamento: este arquivo NUNCA importa de api/pensao/*.

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
    throw new Error('regimeBens participacao_final_aquestos ainda não implementado neste motor (Task 5)')
  } else {
    throw new Error(`regimeBens inválido: ${regimeBens}`)
  }

  if (resultado.classificacao === 'pendente') {
    return { classificacao: 'pendente', regra: '—', citacao: '—', origem: 'pendente', campoFaltante: resultado.campoFaltante }
  }
  return { ...resultado, citacao: resultado.regra, origem: 'automatica' }
}
