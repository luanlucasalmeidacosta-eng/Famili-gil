// api/pensao/_motor-pensao.js
//
// Motor de Execução de Pensão Alimentícia. REGRA + ARITMÉTICA PURAS:
// sem rede, sem IA, sem relógio (nada de Date.now / new Date() sem argumento),
// sem aleatoriedade. Recebe as séries de índice já resolvidas. Mesmo input =>
// mesma saída, byte a byte.

export const FRONTEIRA_LEI = '2024-08-30' // 1º dia do regime pós-Lei 14.905/2024

/** 2 casas decimais, meio para cima, robusto a artefato de ponto flutuante. */
export function arredonda2(n) {
  // normaliza para 3 casas (toFixed arredonda o double real corretamente),
  // depois decide o centavo pelo milésimo em aritmética inteira.
  const milesimos = Math.round(Number(n.toFixed(3)) * 1000)
  const resto = ((milesimos % 10) + 10) % 10
  const base = milesimos - (milesimos % 10)
  return (resto >= 5 ? base + 10 : base) / 1000
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

/**
 * Produto dos fatores diários da SELIC em [iniISO, fimISO).
 * @throws se diasCorridos(ini,fim) > 0 e nenhuma data da série cai no intervalo.
 */
export function fatorSelic(serieDiaria, iniISO, fimISO) {
  if (iniISO === fimISO) return 1
  let fator = 1
  let contou = 0
  for (const [d, taxa] of Object.entries(serieDiaria)) {
    if (d >= iniISO && d < fimISO) {
      fator *= 1 + taxa / 100
      contou += 1
    }
  }
  if (contou === 0 && diasCorridos(iniISO, fimISO) > 0) {
    throw new Error(`SELIC sem dados no intervalo ${iniISO}..${fimISO}`)
  }
  return fator
}

/** 1º dia do mês de uma data ISO. */
function competenciaDe(iso) {
  return `${iso.slice(0, 7)}-01`
}

/** Avança uma competência 'YYYY-MM-01' em 1 mês. */
function proximaCompetencia(compISO) {
  let [ano, mes] = compISO.split('-').map(Number)
  mes += 1
  if (mes > 12) { mes = 1; ano += 1 }
  return `${ano}-${String(mes).padStart(2, '0')}-01`
}

/**
 * Acumula um índice mensal em [iniISO, fimISO) com pró-rata die nas pontas.
 * @throws se faltar a competência de qualquer mês tocado.
 */
export function fatorMensal(serieMensal, iniISO, fimISO) {
  if (iniISO === fimISO) return 1
  let fator = 1
  let comp = competenciaDe(iniISO)
  const compFim = competenciaDe(fimISO) // mês onde termina (exclusivo no dia, mas o mês pode ser tocado)
  // percorre cada competência de comp até (e incluindo) o mês de fimISO, enquanto houver dias no trecho
  while (comp <= compFim) {
    const inicioMes = comp
    const fimMes = proximaCompetencia(comp)
    const a = iniISO > inicioMes ? iniISO : inicioMes
    const b = fimISO < fimMes ? fimISO : fimMes
    const dias = diasCorridos(a, b)
    if (dias > 0) {
      const m = serieMensal[comp]
      if (m == null) throw new Error(`índice mensal ausente para a competência ${comp}`)
      const dim = diasNoMes(comp)
      fator *= dias >= dim ? 1 + m / 100 : 1 + (m / 100) * (dias / dim)
    }
    comp = fimMes
  }
  return fator
}
