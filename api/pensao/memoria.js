// api/pensao/memoria.js
import { clienteDoRequest, json } from '../_core/supabase.js'

export async function buscarMemoria({ supabase, casoId, versao }) {
  let q = supabase.from('pensao_memoria').select('*').eq('caso_id', casoId)
  if (versao != null && versao !== '') {
    q = q.eq('versao', Number(versao))
  } else {
    q = q.order('versao', { ascending: false }).limit(1)
  }
  const { data, error } = await q.maybeSingle()
  if (error) throw Object.assign(new Error(error.message), { status: 500 })
  return data ?? null
}

export async function GET(request) {
  try {
    const { supabase } = clienteDoRequest(request)
    const url = new URL(request.url)
    const casoId = url.searchParams.get('casoId')
    if (!casoId) return json({ erro: 'casoId é obrigatório.' }, 400)
    const versao = url.searchParams.get('versao')
    const m = await buscarMemoria({ supabase, casoId, versao })
    if (!m) return json({ erro: 'Memória não encontrada.' }, 404)
    return json(m)
  } catch (e) {
    return json({ erro: e.message }, e.status || 500)
  }
}
