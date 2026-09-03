// api/pensao/_motor-pensao.js
//
// Motor de Execução de Pensão Alimentícia. REGRA + ARITMÉTICA PURAS:
// sem rede, sem IA, sem relógio (nada de Date.now / new Date() sem argumento),
// sem aleatoriedade. Recebe as séries de índice já resolvidas. Mesmo input =>
// mesma saída, byte a byte.

export const FRONTEIRA_LEI = '2024-08-30' // 1º dia do regime pós-Lei 14.905/2024

/** 2 casas decimais, meio para cima, robusto a ruído de ponto flutuante. */
export function arredonda2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function ms(iso) {
  return Date.parse(`${iso}T00:00:00Z`) // ISO com Z: determinístico, sem timezone
}

/** Dias corridos de aISO até bISO (inteiro; negativo se b < a). */
export function diasCorridos(aISO, bISO) {
  return Math.round((ms(bISO) - ms(aISO)) / 86400000)
}

/** Dias do mês de uma competência 'YYYY-MM-01'. */
export function diasNoMes(competenciaISO) {
  const [ano, mes] = competenciaISO.split('-').map(Number)
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate()
}

/**
 * Quebra [vencISO, dataBaseISO] em 1 ou 2 trechos na FRONTEIRA_LEI.
 * @returns {Array<{ini:string,fim:string,regime:'pre'|'pos'}>}
 */
export function partesTrecho(vencISO, dataBaseISO) {
  if (dataBaseISO <= vencISO) return []
  if (dataBaseISO <= FRONTEIRA_LEI) {
    return [{ ini: vencISO, fim: dataBaseISO, regime: 'pre' }]
  }
  if (vencISO >= FRONTEIRA_LEI) {
    return [{ ini: vencISO, fim: dataBaseISO, regime: 'pos' }]
  }
  return [
    { ini: vencISO, fim: FRONTEIRA_LEI, regime: 'pre' },
    { ini: FRONTEIRA_LEI, fim: dataBaseISO, regime: 'pos' },
  ]
}
