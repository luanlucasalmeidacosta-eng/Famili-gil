// api/casos/excluir.js — exclusão DEFINITIVA (irreversível) de um caso já arquivado.
//
// Ordem: valida sessão + título digitado + flag `arquivado`, limpa os objetos do
// Storage sob o prefixo `${casoId}/` e SÓ ENTÃO apaga a linha `casos` (o cascade
// de FK remove pensao_*/partilha_*/documentos_caso).
//
// Isolamento entre fases: esta rota NÃO importa nada de api/pensao/* nem
// api/partilha/*.
import { createClient } from '@supabase/supabase-js'
import { clienteDoRequest, json } from '../_core/supabase.js'

const erro = (msg, status) => Object.assign(new Error(msg), { status })

// Convenção lida de src/features/AbaDocumentos.jsx: upload em
// `storage.from('documentos').upload(`${caso.id}/${crypto.randomUUID()}-${file.name}`)`
// — todos os objetos de um caso ficam sob o prefixo `${casoId}/`.
const BUCKET = 'documentos'

export async function processarExclusao({ supabase, storage, casoId, tituloConfirmacao }) {
  const { data: caso } = await supabase.from('casos').select('*').eq('id', casoId).maybeSingle()
  if (!caso) throw erro('Caso não encontrado.', 404)
  if (caso.arquivado !== true) throw erro('Só é possível excluir um caso já arquivado.', 422)
  if (caso.titulo !== tituloConfirmacao) throw erro('O título digitado não confere com o do caso.', 422)

  // 1) limpar o Storage sob o prefixo do caso
  const pasta = storage.from(BUCKET)
  const { data: objetos, error: errList } = await pasta.list(casoId)
  if (errList) throw erro(`Falha ao listar os anexos: ${errList.message}`, 502)
  if ((objetos || []).length) {
    const paths = objetos.map((o) => `${casoId}/${o.name}`)
    const { error: errRm } = await pasta.remove(paths)
    if (errRm) throw erro(`Falha ao remover os anexos: ${errRm.message}`, 502)
  }

  // 2) apagar a linha — o cascade de FK remove pensao_*/partilha_*/documentos_caso
  const { error: errDel } = await supabase.from('casos').delete().eq('id', casoId)
  if (errDel) throw erro(`Falha ao excluir o caso: ${errDel.message}`, 500)

  return { ok: true }
}

export async function POST(request) {
  try {
    const { supabase } = clienteDoRequest(request)
    const { casoId, tituloConfirmacao } = await request.json()
    // Storage precisa da service key para apagar objetos de qualquer usuário-dono.
    const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    const out = await processarExclusao({ supabase, storage: admin.storage, casoId, tituloConfirmacao })
    return json(out, 200)
  } catch (e) {
    return json({ erro: e.message }, e.status || 500)
  }
}
