// api/_core/ratelimit.js
//
// Rate limiter simples, em memória, sem dependências. Roda em Node e Edge.
// LIMITAÇÃO: estado por instância da função — "quebra-molas" contra abuso
// casual, não um limite global forte.
//
// Prefixo "_": a Vercel não expõe como rota. (Fica em _core/ por convenção;
// a Vercel só roteia arquivos .js diretamente sob api/ e subpastas SEM "_".)

const baldes = new Map()

/**
 * @param {string} chave normalmente o IP do cliente
 * @param {number} limite requisições permitidas na janela
 * @param {number} janelaMs tamanho da janela em ms
 * @returns {{ ok: true } | { ok: false, retryMs: number }}
 */
export function rateLimit(chave, limite, janelaMs) {
  const agora = Date.now()
  const b = baldes.get(chave)
  if (!b || agora >= b.reset) {
    baldes.set(chave, { n: 1, reset: agora + janelaMs })
    return { ok: true }
  }
  b.n += 1
  if (baldes.size > 5000) {
    for (const [k, v] of baldes) if (agora >= v.reset) baldes.delete(k)
  }
  return b.n <= limite ? { ok: true } : { ok: false, retryMs: b.reset - agora }
}

/** Extrai o IP do cliente de um Request (Web API), com fallback. */
export function ipDoRequest(request) {
  const xff = request.headers.get('x-forwarded-for') || ''
  return xff.split(',')[0].trim() || request.headers.get('x-real-ip') || 'desconhecido'
}
