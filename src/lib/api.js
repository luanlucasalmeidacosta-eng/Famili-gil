import { supabase } from './supabase.js'

async function authHeaders() {
  const { data } = await supabase.auth.getSession()
  const tok = data?.session?.access_token
  return tok ? { Authorization: `Bearer ${tok}` } : {}
}

export async function apiFetch(path, opts = {}) {
  const headers = { 'content-type': 'application/json', ...(await authHeaders()), ...(opts.headers || {}) }
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers,
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
  })
  if (!res.ok) {
    let msg = 'falha na requisição'
    try { msg = (await res.json()).erro || msg } catch { /* corpo não-JSON */ }
    throw new Error(msg)
  }
  return res.json()
}

export async function apiFetchBlob(path) {
  const res = await fetch(path, { headers: await authHeaders() })
  if (!res.ok) {
    let msg = 'falha ao exportar'
    try { msg = (await res.json()).erro || msg } catch { /* ignore */ }
    throw new Error(msg)
  }
  const cd = res.headers.get('content-disposition') || ''
  const m = cd.match(/filename="([^"]+)"/)
  return { blob: await res.blob(), filename: m ? m[1] : 'download' }
}
