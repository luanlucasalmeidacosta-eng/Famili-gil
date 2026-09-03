import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'

export default function AbaPagamentos({ caso }) {
  const [pgs, setPgs] = useState([])
  const [parcelas, setParcelas] = useState([])
  const [f, setF] = useState({ data_pagamento: '', valor: '', identificado_para: '', observacao: '' })
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))

  const carregar = useCallback(async () => {
    const { data } = await supabase.from('pensao_pagamentos').select('*').eq('caso_id', caso.id).order('data_pagamento')
    setPgs(data || [])
    const { data: pc } = await supabase.from('pensao_parcelas').select('id, competencia').eq('caso_id', caso.id).order('competencia')
    setParcelas(pc || [])
  }, [caso.id])
  useEffect(() => { carregar() }, [carregar])

  async function lancar(e) {
    e.preventDefault()
    await supabase.from('pensao_pagamentos').insert({
      caso_id: caso.id,
      data_pagamento: f.data_pagamento,
      valor: Number(f.valor),
      identificado_para: f.identificado_para || null,
      observacao: f.observacao || null,
    })
    setF({ data_pagamento: '', valor: '', identificado_para: '', observacao: '' })
    carregar()
  }
  async function remover(id) {
    await supabase.from('pensao_pagamentos').delete().eq('id', id)
    carregar()
  }

  return (
    <div className="text-sm">
      <form onSubmit={lancar} className="mb-4 grid max-w-md gap-3">
        <label>Data do pagamento
          <input type="date" value={f.data_pagamento} onChange={set('data_pagamento')} required className="mt-1 w-full rounded border px-2 py-1" />
        </label>
        <label>Valor (R$)
          <input aria-label="valor" type="number" step="0.01" value={f.valor} onChange={set('valor')} required className="mt-1 w-full rounded border px-2 py-1" />
        </label>
        <label>Prender à parcela (opcional)
          <select value={f.identificado_para} onChange={set('identificado_para')} className="mt-1 w-full rounded border px-2 py-1">
            <option value="">— não identificado —</option>
            {parcelas.map((p) => <option key={p.id} value={p.id}>{p.competencia?.slice(0, 7)}</option>)}
          </select>
        </label>
        <label>Observação
          <input value={f.observacao} onChange={set('observacao')} className="mt-1 w-full rounded border px-2 py-1" />
        </label>
        <button type="submit" className="rounded bg-neutral-900 px-3 py-1.5 text-white">Lançar pagamento</button>
      </form>
      <ul className="divide-y rounded border">
        {pgs.map((p) => (
          <li key={p.id} className="flex items-center justify-between p-2">
            <span>{p.data_pagamento} — R$ {Number(p.valor).toFixed(2)} {p.identificado_para ? '(preso a uma parcela)' : ''}</span>
            <button onClick={() => remover(p.id)} className="text-xs text-red-600">Remover</button>
          </li>
        ))}
        {pgs.length === 0 && <li className="p-3 text-neutral-500">Nenhum pagamento lançado.</li>}
      </ul>
    </div>
  )
}
