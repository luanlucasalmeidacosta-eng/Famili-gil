// api/_core/focus-bcb.js
//
// Integração com a API Olinda de Expectativas de Mercado (Boletim Focus) do
// Banco Central. Mesma filosofia de indices-bcb.js: funções puras + um
// orquestrador cache-first que recebe as portas de I/O por injeção.
//
// Endpoint e nomes de campo confirmados pela sondagem em scripts/spike-focus.mjs
// (Plano 04b, Task 2):
//   - IPCA  → série MENSAL  ('ExpectativaMercadoMensais'), DataReferencia 'MM/AAAA',
//             Mediana = variação % no mês.
//   - SELIC → série ANUAL   ('ExpectativasMercadoAnuais'),  DataReferencia 'AAAA',
//             Mediana = meta Selic % a.a. ao fim do ano. A série mensal de Selic
//             do Focus foi descontinuada em 2005 (a Selic é definida pelo COPOM),
//             então a projeção anual é expandida para todas as competências do ano.
//   - Campos: Indicador / Data (data do boletim) / DataReferencia / Mediana.
//   - baseCalculo eq 0 = expectativas dos últimos 30 dias (mais respondentes).

const OLINDA_BASE = 'https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata'
const ENDPOINT_MENSAL = 'ExpectativaMercadoMensais'
const ENDPOINT_ANUAL = 'ExpectativasMercadoAnuais'
const INDICADOR = { IPCA: 'IPCA', SELIC: 'Selic' }
const CAMPOS = { indicador: 'Indicador', data: 'Data', dataReferencia: 'DataReferencia', mediana: 'Mediana' }

export const SERIES_FOCUS = { ...INDICADOR }

function refParaCompetencia(mmAaaa) {
  // 'MM/AAAA' → 'AAAA-MM-01'
  const [mm, aaaa] = String(mmAaaa).trim().split('/')
  return `${aaaa}-${mm.padStart(2, '0')}-01`
}

function competenciasEntre(iniISO, fimISO) {
  const out = []
  let [a, m] = iniISO.split('-').map(Number)
  const fim = fimISO.slice(0, 7)
  while (`${a}-${String(m).padStart(2, '0')}` <= fim) {
    out.push(`${a}-${String(m).padStart(2, '0')}-01`)
    m += 1
    if (m > 12) { m = 1; a += 1 }
  }
  return out
}

/**
 * @param {Array<object>} value linhas do campo `value` da resposta OData
 * @param {{indicador,data,dataReferencia,mediana}} campos
 * @returns {{dataBoletim:string, valores:Record<string,number>}}
 */
export function parseFocusMensal(value, campos = CAMPOS) {
  if (!value.length) throw new Error('Focus: resposta vazia.')
  const dataBoletim = value
    .map((r) => String(r[campos.data]).slice(0, 10))
    .sort()
    .at(-1)
  const valores = {}
  for (const r of value) {
    if (String(r[campos.data]).slice(0, 10) !== dataBoletim) continue
    valores[refParaCompetencia(r[campos.dataReferencia])] = Number(r[campos.mediana])
  }
  return { dataBoletim, valores }
}

/**
 * Parse da série ANUAL (Selic): DataReferencia é o ano 'AAAA'.
 * @returns {{dataBoletim:string, porAno:Record<string,number>}}
 */
export function parseFocusAnual(value, campos = CAMPOS) {
  if (!value.length) throw new Error('Focus: resposta vazia.')
  const dataBoletim = value
    .map((r) => String(r[campos.data]).slice(0, 10))
    .sort()
    .at(-1)
  const porAno = {}
  for (const r of value) {
    if (String(r[campos.data]).slice(0, 10) !== dataBoletim) continue
    porAno[String(r[campos.dataReferencia]).trim()] = Number(r[campos.mediana])
  }
  return { dataBoletim, porAno }
}

function urlLatest(endpoint, ind) {
  return `${OLINDA_BASE}/${endpoint}?$format=json&$top=1` +
    `&$filter=${CAMPOS.indicador} eq '${ind}' and baseCalculo eq 0` +
    `&$orderby=${CAMPOS.data} desc`
}

function urlBoletim(endpoint, ind, dataBoletim) {
  return `${OLINDA_BASE}/${endpoint}?$format=json&$top=200` +
    `&$filter=${CAMPOS.indicador} eq '${ind}' and baseCalculo eq 0 and ${CAMPOS.data} eq '${dataBoletim}'`
}

/**
 * Busca a projeção do boletim mais recente para `serie` e recorta as
 * competências em [competenciaInicioISO, competenciaFimISO].
 * @returns {Promise<{dataBoletim:string, valores:Record<string,number>}>}
 */
export async function buscarProjecaoFocus({ serie, competenciaInicioISO, competenciaFimISO, fetchImpl }) {
  const anual = serie === 'SELIC'
  const endpoint = anual ? ENDPOINT_ANUAL : ENDPOINT_MENSAL
  const ind = INDICADOR[serie]

  const respLatest = await fetchImpl(urlLatest(endpoint, ind))
  if (!respLatest.ok) throw new Error(`Focus ${serie} indisponível (HTTP ${respLatest.status})`)
  const latestLinhas = (await respLatest.json()).value || []
  if (!latestLinhas.length) throw new Error(`Focus ${serie}: nenhum boletim disponível.`)
  const dataBoletim = String(latestLinhas[0][CAMPOS.data]).slice(0, 10)

  const respBoletim = await fetchImpl(urlBoletim(endpoint, ind, dataBoletim))
  if (!respBoletim.ok) throw new Error(`Focus ${serie} indisponível (HTTP ${respBoletim.status})`)
  const linhas = (await respBoletim.json()).value || []

  const recorte = {}
  if (anual) {
    const { porAno } = parseFocusAnual(linhas)
    for (const comp of competenciasEntre(competenciaInicioISO, competenciaFimISO)) {
      const ano = comp.slice(0, 4)
      if (porAno[ano] != null) recorte[comp] = porAno[ano]
    }
  } else {
    const { valores } = parseFocusMensal(linhas)
    for (const [comp, v] of Object.entries(valores)) {
      if (comp >= competenciaInicioISO && comp <= competenciaFimISO) recorte[comp] = v
    }
  }
  return { dataBoletim, valores: recorte }
}

/**
 * Resolve as projeções pedidas, cache-first.
 * - sem `dataBoletimFixada`: usa o boletim mais recente (busca se o cache
 *   não tiver nada no intervalo), grava no cache.
 * - com `dataBoletimFixada`: lê SÓ esse boletim do cache (recálculo de
 *   versão), nunca busca boletim novo.
 * @returns {Promise<{dataBoletim:string, series:Record<string,Record<string,number>>}>}
 */
export async function resolverProjecao({
  pedidos, competenciaInicioISO, competenciaFimISO, cachePortFocus, fetchImpl, dataBoletimFixada,
}) {
  const series = {}
  let dataBoletim = dataBoletimFixada || null

  for (const { serie } of pedidos) {
    if (dataBoletimFixada) {
      const r = await cachePortFocus.lerBoletim(serie, dataBoletimFixada, competenciaInicioISO, competenciaFimISO)
      series[serie] = r?.valores || {}
      continue
    }
    const doCache = await cachePortFocus.ler(serie, competenciaInicioISO, competenciaFimISO)
    if (doCache && Object.keys(doCache.valores || {}).length > 0) {
      series[serie] = doCache.valores
      dataBoletim = doCache.dataBoletim
      continue
    }
    const buscado = await buscarProjecaoFocus({ serie, competenciaInicioISO, competenciaFimISO, fetchImpl })
    await cachePortFocus.gravar(serie, buscado.dataBoletim, buscado.valores)
    series[serie] = buscado.valores
    dataBoletim = buscado.dataBoletim
  }
  return { dataBoletim, series }
}
