// api/partilha/memoria.js
import { clienteDoRequest, json } from '../_core/supabase.js'

export async function buscarMemoria({ supabase, casoId, versao }) {
  let q = supabase.from('partilha_memoria').select('*').eq('caso_id', casoId)
  q = (versao != null && versao !== '') ? q.eq('versao', Number(versao)) : q.order('versao', { ascending: false }).limit(1)
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

    const comparar = url.searchParams.get('comparar')
    if (comparar) {
      const [v1, v2] = comparar.split(',').map((s) => s.trim())
      const [m1, m2] = await Promise.all([
        buscarMemoria({ supabase, casoId, versao: v1 }),
        buscarMemoria({ supabase, casoId, versao: v2 }),
      ])
      if (!m1 || !m2) return json({ erro: 'Uma ou ambas as versões não foram encontradas.' }, 404)
      return json([m1, m2])
    }

    const versao = url.searchParams.get('versao')
    const m = await buscarMemoria({ supabase, casoId, versao })
    if (!m) return json({ erro: 'Memória não encontrada.' }, 404)
    return json(m)
  } catch (e) {
    return json({ erro: e.message }, e.status || 500)
  }
}
