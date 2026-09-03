// api/_core/supabase.js
//
// Helpers server-side. O isolamento de dados vem do token do usuário + RLS:
// cada request traz seu Bearer token, e o client é criado já com esse header,
// então toda query roda como o usuário.

import { createClient } from '@supabase/supabase-js'

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

/**
 * @param {Request} request
 * @param {{url?: string, anonKey?: string}} [cfg] override para teste; em produção
 *        vem de process.env.SUPABASE_URL / SUPABASE_ANON_KEY OU do corpo da request
 *        (padrão TributÁgil). Aqui usamos env do servidor.
 * @returns {{ supabase: import('@supabase/supabase-js').SupabaseClient, userToken: string }}
 */
export function clienteDoRequest(request, cfg = {}) {
  const auth = request.headers.get('authorization') || ''
  const userToken = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!userToken) {
    const err = new Error('token de autenticação ausente')
    err.status = 401
    throw err
  }
  const url = cfg.url || process.env.SUPABASE_URL
  const anonKey = cfg.anonKey || process.env.SUPABASE_ANON_KEY
  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${userToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return { supabase, userToken }
}
