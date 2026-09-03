import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'

export default function Casos() {
  const navigate = useNavigate()
  const [casos, setCasos] = useState([])
  const [abrindo, setAbrindo] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [tipo, setTipo] = useState('pensao')
  const [erro, setErro] = useState('')

  async function carregar() {
    const { data, error } = await supabase
      .from('casos').select('*').eq('arquivado', false).order('criado_em', { ascending: false })
    if (!error) setCasos(data ?? [])
  }
  useEffect(() => { carregar() }, [])

  async function criar(e) {
    e.preventDefault()
    setErro('')
    const { data, error } = await supabase
      .from('casos').insert({ titulo, tipo, parte_a: '', parte_b: '' }).select()
    if (error) { setErro(error.message); return }
    navigate(`/caso/${data[0].id}`)
  }

  async function arquivar(id) {
    await supabase.from('casos').update({ arquivado: true }).eq('id', id)
    carregar()
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Casos</h1>
        <button onClick={() => setAbrindo(true)} className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white">
          Novo caso
        </button>
      </div>

      <ul className="divide-y rounded-lg border bg-white">
        {casos.map((c) => (
          <li key={c.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <button className="text-left" onClick={() => navigate(`/caso/${c.id}`)}>
              <span className="font-medium">{c.titulo}</span>
              <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-xs uppercase">{c.tipo}</span>
            </button>
            <button onClick={() => arquivar(c.id)} className="text-xs text-neutral-500 hover:text-red-600">
              Arquivar
            </button>
          </li>
        ))}
        {casos.length === 0 && <li className="px-4 py-6 text-sm text-neutral-500">Nenhum caso ainda.</li>}
      </ul>

      {abrindo && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30">
          <form onSubmit={criar} className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6">
            <h2 className="font-semibold">Novo caso</h2>
            <label className="block text-sm">
              Título
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)} required
                className="mt-1 w-full rounded border px-3 py-2" />
            </label>
            <fieldset className="text-sm">
              <legend className="mb-1">Tipo</legend>
              <label className="mr-4">
                <input type="radio" name="tipo" value="pensao"
                  checked={tipo === 'pensao'} onChange={() => setTipo('pensao')} /> Pensão
              </label>
              <label>
                <input type="radio" name="tipo" value="partilha"
                  checked={tipo === 'partilha'} onChange={() => setTipo('partilha')} /> Partilha
              </label>
            </fieldset>
            {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAbrindo(false)} className="rounded px-3 py-1.5 text-sm">
                Cancelar
              </button>
              <button type="submit" className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white">
                Criar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
