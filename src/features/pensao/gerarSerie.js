// src/features/pensao/gerarSerie.js
//
// Gera a série de parcelas a partir da "regra" da pensão. Função PURA e
// determinística — usada pela AbaParcelas e testada isolada.

function arredonda2(n) {
  // normaliza para 3 casas (toFixed arredonda o double real corretamente),
  // depois decide o centavo pelo milésimo em aritmética inteira.
  const milesimos = Math.round(Number(n.toFixed(3)) * 1000)
  const resto = ((milesimos % 10) + 10) % 10
  const base = milesimos - (milesimos % 10)
  return (resto >= 5 ? base + 10 : base) / 1000
}

function ultimoDiaDoMes(ano, mes1) {
  // mes1: 1-based. Date.UTC(ano, mes1, 0) = último dia do mês mes1.
  return new Date(Date.UTC(ano, mes1, 0)).getUTCDate()
}

function pad2(n) { return String(n).padStart(2, '0') }

/**
 * @param {object} params
 * @returns {Array<{competencia:string,vencimento:string,valorDevido:number,origem:'gerada',ativa:true}>}
 */
export function gerarSerie(params) {
  const {
    tipoValor, valorBase, salarioMinimoRef, rendimentoRef,
    diaVencimento, dataInicial, dataFinal,
  } = params

  if (dataInicial > dataFinal) throw new Error(`dataInicial ${dataInicial} > dataFinal ${dataFinal}`)

  let valor
  if (tipoValor === 'fixo') {
    valor = arredonda2(valorBase)
  } else if (tipoValor === 'pct_salario_minimo') {
    if (salarioMinimoRef == null) throw new Error('pct_salario_minimo exige salarioMinimoRef')
    valor = arredonda2((valorBase / 100) * salarioMinimoRef)
  } else if (tipoValor === 'pct_rendimento') {
    if (rendimentoRef == null) throw new Error('pct_rendimento exige rendimentoRef')
    valor = arredonda2((valorBase / 100) * rendimentoRef)
  } else {
    throw new Error(`tipoValor inválido: ${tipoValor}`)
  }

  const [aI, mI] = dataInicial.split('-').map(Number)
  const [aF, mF] = dataFinal.split('-').map(Number)
  const out = []
  let ano = aI
  let mes = mI
  while (ano < aF || (ano === aF && mes <= mF)) {
    const dia = Math.min(diaVencimento, ultimoDiaDoMes(ano, mes))
    out.push({
      competencia: `${ano}-${pad2(mes)}-01`,
      vencimento: `${ano}-${pad2(mes)}-${pad2(dia)}`,
      valorDevido: valor,
      origem: 'gerada',
      ativa: true,
    })
    mes += 1
    if (mes > 12) { mes = 1; ano += 1 }
  }
  return out
}
