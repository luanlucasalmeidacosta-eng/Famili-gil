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
