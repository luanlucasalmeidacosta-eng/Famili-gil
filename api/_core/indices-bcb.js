// api/_core/indices-bcb.js
//
// Integração com o SGS (Sistema Gerenciador de Séries Temporais) do Banco
// Central. Funções puras + um orquestrador cache-first que recebe as portas
// de I/O (fetch, cache) por injeção — nada de rede/banco embutido, para
// testar sem dependências e garantir determinismo no que é puro.
//
// Prefixo "_": não é rota Vercel.

export const SERIES = { SELIC_DIARIA: 11, IPCA: 433, INPC: 188, IGPM: 189, IPCA15: 7478 }

const MAX_ANOS_JANELA = 10

function isoParaBR(iso) {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

/**
 * Quebra [inicioISO, fimISO] em janelas contíguas de no máximo 10 anos.
 * @param {string} inicioISO 'YYYY-MM-DD'
 * @param {string} fimISO 'YYYY-MM-DD'
 * @returns {Array<{inicioBR: string, fimBR: string}>}
 */
export function janelasDe10Anos(inicioISO, fimISO) {
  if (inicioISO > fimISO) throw new Error(`intervalo invertido: ${inicioISO} > ${fimISO}`)
  const janelas = []
  let cursor = inicioISO
  while (cursor <= fimISO) {
    const anoCursor = Number(cursor.slice(0, 4))
    const fimJanelaISO = `${anoCursor + MAX_ANOS_JANELA - 1}-12-31`
    const fim = fimJanelaISO < fimISO ? fimJanelaISO : fimISO
    janelas.push({ inicioBR: isoParaBR(cursor), fimBR: isoParaBR(fim) })
    if (fim === fimISO) break
    cursor = `${anoCursor + MAX_ANOS_JANELA}-01-01`
  }
  return janelas
}

/**
 * Normaliza o payload JSON do SGS.
 * @param {Array<{data: string, valor: string}>} payload
 * @param {'dia'|'mes'} tipoRef
 * @returns {Array<{ref: string, valor: number}>}
 */
export function parseSgsJson(payload, tipoRef) {
  const out = []
  for (const item of payload) {
    if (item?.valor == null || String(item.valor).trim() === '') continue
    const [d, m, a] = item.data.split('/')
    const ref = tipoRef === 'mes' ? `${a}-${m}-01` : `${a}-${m}-${d}`
    out.push({ ref, valor: Number(item.valor) })
  }
  return out
}

const SGS_BASE = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs'

function urlSgs(codigo, inicioBR, fimBR) {
  return `${SGS_BASE}.${codigo}/dados?formato=json&dataInicial=${inicioBR}&dataFinal=${fimBR}`
}

/**
 * Busca uma série no SGS, janelada em 10 anos.
 * @returns {Promise<Array<{ref: string, valor: number}>>}
 * @throws {Error} se qualquer janela responder não-OK
 */
export async function buscarSerieNoSgs({ codigo, tipoRef, inicioISO, fimISO, fetchImpl }) {
  const janelas = janelasDe10Anos(inicioISO, fimISO)
  const porRef = new Map()
  for (const { inicioBR, fimBR } of janelas) {
    const resp = await fetchImpl(urlSgs(codigo, inicioBR, fimBR))
    if (!resp.ok) {
      throw new Error(
        `SGS série ${codigo} indisponível para ${inicioBR}–${fimBR} (HTTP ${resp.status})`,
      )
    }
    const payload = await resp.json()
    for (const { ref, valor } of parseSgsJson(payload, tipoRef)) porRef.set(ref, valor)
  }
  return [...porRef.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([ref, valor]) => ({ ref, valor }))
}

/**
 * Resolve as séries pedidas, cache-first.
 *
 * ATENÇÃO (v1): a detecção de "cache incompleto" é grossa — se o cache tem
 * QUALQUER ponto para a chave no intervalo, ele é usado como está e o SGS
 * NÃO é consultado. Portanto o retorno PODE não cobrir todas as competências
 * de [inicioISO, fimISO] se o cache estiver desatualizado. Quem chama (ex.:
 * api/pensao/calcular.js no Plano 02) DEVE verificar que toda competência
 * necessária está presente e responder erro em caso de lacuna — nunca
 * calcular com série furada (requisito inviolável: "índice ausente = erro").
 *
 * @returns {Promise<Record<string, Record<string, number>>>}
 */
export async function resolverSeries({ pedidos, inicioISO, fimISO, cachePort, fetchImpl }) {
  const resultado = {}
  for (const { chave, codigo, tipoRef } of pedidos) {
    const doCache = (await cachePort.ler(chave, inicioISO, fimISO)) || {}
    if (Object.keys(doCache).length > 0) {
      resultado[chave] = { ...doCache }
      continue
    }
    const doSgs = await buscarSerieNoSgs({ codigo, tipoRef, inicioISO, fimISO, fetchImpl })
    await cachePort.gravar(chave, doSgs)
    resultado[chave] = Object.fromEntries(doSgs.map(({ ref, valor }) => [ref, valor]))
  }
  return resultado
}
