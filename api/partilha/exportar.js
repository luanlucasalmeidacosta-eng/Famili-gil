// api/partilha/exportar.js
import { clienteDoRequest, json } from '../_core/supabase.js'
import { buscarMemoria } from './memoria.js'
import { partilhaParaDocx } from '../_core/docx.js'
import { partilhaParaXlsx } from '../_core/xlsx.js'

const CT = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

export async function montarExport({ supabase, casoId, versao, formato }) {
  if (formato !== 'docx' && formato !== 'xlsx') {
    throw Object.assign(new Error('formato deve ser docx ou xlsx.'), { status: 400 })
  }
  const memoria = await buscarMemoria({ supabase, casoId, versao })
  if (!memoria) throw Object.assign(new Error('Memória não encontrada.'), { status: 404 })
  const { data: caso } = await supabase.from('casos').select('*').eq('id', casoId).maybeSingle()

  const bytes = formato === 'xlsx'
    ? await partilhaParaXlsx(memoria, caso || {})
    : await partilhaParaDocx(memoria, caso || {})
  return { bytes, contentType: CT[formato], filename: `memoria-partilha-v${memoria.versao}.${formato}` }
}

export async function GET(request) {
  try {
    const { supabase } = clienteDoRequest(request)
    const url = new URL(request.url)
    const casoId = url.searchParams.get('casoId')
    const versao = url.searchParams.get('versao')
    const formato = url.searchParams.get('formato')
    if (!casoId) return json({ erro: 'casoId é obrigatório.' }, 400)
    const { bytes, contentType, filename } = await montarExport({ supabase, casoId, versao, formato })
    return new Response(bytes, {
      headers: { 'content-type': contentType, 'content-disposition': `attachment; filename="${filename}"` },
    })
  } catch (e) {
    return json({ erro: e.message }, e.status || 500)
  }
}
