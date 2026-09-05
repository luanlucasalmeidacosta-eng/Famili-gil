import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'

const NATUREZAS = ['anterior_casamento', 'constancia_proveito_comum', 'constancia_particular', 'ato_ilicito', 'tributo_de_bem', 'outro']

export default function AbaPassivos({ caso }) {
  const [passivos, setPassivos] = useState([])
  const [bens, setBens] = useState([])
  const [f, setF] = useState({ descricao: '', valor: '', natureza: 'constancia_proveito_comum', responsavel: 'ambos', bemVinculadoId: '' })

  const carregar = useCallback(async () => {
    const { data: p } = await supabase.from('partilha_passivos').select('*').eq('caso_id', caso.id).order('descricao')
    setPassivos(p || [])
    const { data: b } = await supabase.from('partilha_bens').select('id, descricao').eq('caso_id', caso.id).order('descricao')
    setBens(b || [])
  }, [caso.id])
  useEffect(() => { carregar() }, [carregar])

  async function adicionar(e) {
    e.preventDefault()
    await supabase.from('partilha_passivos').insert({
      caso_id: caso.id, descricao: f.descricao, valor: Number(f.valor), natureza: f.natureza,
      responsavel: f.responsavel, bem_vinculado_id: f.bemVinculadoId || null,
    })
    setF({ descricao: '', valor: '', natureza: 'constancia_proveito_comum', responsavel: 'ambos', bemVinculadoId: '' })
    carregar()
  }
  async function remover(id) {
    await supabase.from('partilha_passivos').delete().eq('id', id)
    carregar()
  }

  return (
    <div className="text-sm">
      <form onSubmit={adicionar} className="mb-4 grid max-w-md gap-3">
        <label>Descrição
          <input value={f.descricao} onChange={(e) => setF((s) => ({ ...s, descricao: e.target.value }))} required className="mt-1 w-full rounded border px-2 py-1" />
        </label>
        <label>Valor (R$)
          <input aria-label="valor" type="number" step="0.01" value={f.valor} onChange={(e) => setF((s) => ({ ...s, valor: e.target.value }))} required className="mt-1 w-full rounded border px-2 py-1" />
        </label>
        <label>Natureza
          <select value={f.natureza} onChange={(e) => setF((s) => ({ ...s, natureza: e.target.value }))} className="mt-1 w-full rounded border px-2 py-1">
            {NATUREZAS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label>Responsável
          <select value={f.responsavel} onChange={(e) => setF((s) => ({ ...s, responsavel: e.target.value }))} className="mt-1 w-full rounded border px-2 py-1">
            <option value="parte_a">Parte A</option>
            <option value="parte_b">Parte B</option>
            <option value="ambos">Ambos</option>
          </select>
        </label>
        <label>Vinculado a um bem (opcional)
          <select value={f.bemVinculadoId} onChange={(e) => setF((s) => ({ ...s, bemVinculadoId: e.target.value }))} className="mt-1 w-full rounded border px-2 py-1">
            <option value="">— nenhum —</option>
            {bens.map((b) => <option key={b.id} value={b.id}>{b.descricao}</option>)}
          </select>
        </label>
        <button type="submit" className="rounded bg-neutral-900 px-3 py-1.5 text-white">Adicionar passivo</button>
      </form>
      <ul className="divide-y rounded border">
        {passivos.map((p) => (
          <li key={p.id} className="flex items-center justify-between p-2">
            <span>{p.descricao} — R$ {Number(p.valor).toFixed(2)} <span className="rounded bg-neutral-100 px-1.5 text-xs">{p.natureza}</span></span>
            <button onClick={() => remover(p.id)} className="text-xs text-red-600">Remover</button>
          </li>
        ))}
        {passivos.length === 0 && <li className="p-3 text-neutral-500">Nenhum passivo cadastrado.</li>}
      </ul>
    </div>
  )
}
