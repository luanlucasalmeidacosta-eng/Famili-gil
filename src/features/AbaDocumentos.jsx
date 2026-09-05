import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'

const TIPOS = ['sentenca', 'acordo', 'comprovante', 'extrato', 'matricula', 'outro']

export default function AbaDocumentos({ caso }) {
  const [docs, setDocs] = useState([])
  const [tipo, setTipo] = useState('sentenca')
  const [msg, setMsg] = useState('')
  const inputRef = useRef(null)

  const carregar = useCallback(async () => {
    const { data } = await supabase.from('documentos_caso').select('*').eq('caso_id', caso.id).order('enviado_em')
    setDocs(data || [])
  }, [caso.id])
  useEffect(() => { carregar() }, [carregar])

  async function enviar(e) {
    e.preventDefault()
    setMsg('')
    const file = inputRef.current?.files?.[0]
    if (!file) { setMsg('Escolha um arquivo.'); return }
    const storagePath = `${caso.id}/${crypto.randomUUID()}-${file.name}`
    const up = await supabase.storage.from('documentos').upload(storagePath, file)
    if (up.error) { setMsg(`Erro no upload: ${up.error.message}`); return }
    const ins = await supabase.from('documentos_caso').insert({
      caso_id: caso.id, nome: file.name, storage_path: storagePath, tipo,
    })
    setMsg(ins.error ? `Erro ao registrar: ${ins.error.message}` : 'Documento enviado.')
    if (inputRef.current) inputRef.current.value = ''
    carregar()
  }
  async function baixar(d) {
    const { data } = await supabase.storage.from('documentos').createSignedUrl(d.storage_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener')
  }
  async function remover(d) {
    await supabase.storage.from('documentos').remove([d.storage_path])
    await supabase.from('documentos_caso').delete().eq('id', d.id)
    carregar()
  }

  return (
    <div className="text-sm">
      <form onSubmit={enviar} className="mb-4 flex flex-wrap items-end gap-3">
        <label>Arquivo
          <input ref={inputRef} aria-label="arquivo" type="file" className="mt-1 block" />
        </label>
        <label>Tipo
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="mt-1 block rounded border px-2 py-1">
            {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <button type="submit" className="rounded bg-neutral-900 px-3 py-1.5 text-white">Enviar</button>
      </form>
      {msg && <p role="status" className="mb-2 text-neutral-600">{msg}</p>}
      <ul className="divide-y rounded border">
        {docs.map((d) => (
          <li key={d.id} className="flex items-center justify-between p-2">
            <span>{d.nome} <span className="rounded bg-neutral-100 px-1.5 text-xs">{d.tipo}</span></span>
            <span className="flex gap-3">
              <button onClick={() => baixar(d)} className="text-xs text-blue-600">Baixar</button>
              <button onClick={() => remover(d)} className="text-xs text-red-600">Remover</button>
            </span>
          </li>
        ))}
        {docs.length === 0 && <li className="p-3 text-neutral-500">Nenhum documento anexado.</li>}
      </ul>
    </div>
  )
}
