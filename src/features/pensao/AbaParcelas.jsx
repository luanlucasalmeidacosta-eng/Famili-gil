import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { gerarSerie } from './gerarSerie.js'

export default function AbaParcelas({ caso }) {
  const [linhas, setLinhas] = useState([])
  const [msg, setMsg] = useState('')

  const carregar = useCallback(async () => {
    const { data } = await supabase.from('pensao_parcelas').select('*').eq('caso_id', caso.id).order('competencia')
    setLinhas(data || [])
  }, [caso.id])
  useEffect(() => { carregar() }, [carregar])

  async function gerar() {
    setMsg('')
    const { data: p } = await supabase.from('pensao_parametros').select('*').eq('caso_id', caso.id).maybeSingle()
    if (!p) { setMsg('Defina os parâmetros primeiro.'); return }
    let serie
    try {
      serie = gerarSerie({
        tipoValor: p.tipo_valor, valorBase: Number(p.valor_base),
        salarioMinimoRef: p.salario_minimo_ref, rendimentoRef: p.rendimento_ref,
        diaVencimento: p.dia_vencimento, dataInicial: p.data_inicial, dataFinal: p.data_final,
      })
    } catch (e) { setMsg(`Não foi possível gerar: ${e.message}`); return }

    const existentes = new Map(linhas.map((l) => [l.competencia, l]))
    const compsNovas = new Set(serie.map((s) => s.competencia))
    // remove só as 'gerada' cuja competência saiu da nova série
    for (const l of linhas) {
      if (l.origem === 'gerada' && !compsNovas.has(l.competencia)) {
        await supabase.from('pensao_parcelas').delete().eq('id', l.id)
      }
    }
    for (const s of serie) {
      const ex = existentes.get(s.competencia)
      if (ex && ex.origem === 'manual') continue // preserva manual
      if (ex) {
        await supabase.from('pensao_parcelas').update({ vencimento: s.vencimento, valor_devido: s.valorDevido }).eq('id', ex.id)
      } else {
        await supabase.from('pensao_parcelas').insert({
          caso_id: caso.id, competencia: s.competencia, vencimento: s.vencimento,
          valor_devido: s.valorDevido, origem: 'gerada', ativa: true,
        })
      }
    }
    setMsg('Série gerada. Parcelas manuais e inativações preservadas.')
    carregar()
  }

  async function patch(id, campo, valor) {
    await supabase.from('pensao_parcelas').update({ [campo]: valor }).eq('id', id)
    setLinhas((ls) => ls.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)))
  }
  async function adicionar() {
    await supabase.from('pensao_parcelas').insert({
      caso_id: caso.id, competencia: `${new Date().getUTCFullYear()}-01-01`,
      vencimento: `${new Date().getUTCFullYear()}-01-10`, valor_devido: 0, origem: 'manual', ativa: true,
    })
    carregar()
  }
  async function remover(id) {
    await supabase.from('pensao_parcelas').delete().eq('id', id)
    carregar()
  }

  return (
    <div className="text-sm">
      <div className="mb-3 flex gap-2">
        <button onClick={gerar} className="rounded bg-neutral-900 px-3 py-1.5 text-white">Gerar série</button>
        <button onClick={adicionar} className="rounded border px-3 py-1.5">+ Adicionar parcela</button>
      </div>
      {msg && <p role="status" className="mb-2 text-neutral-600">{msg}</p>}
      <table className="w-full border">
        <thead><tr className="bg-neutral-50 text-left">
          <th className="p-2">Competência</th><th className="p-2">Vencimento</th><th className="p-2">Valor devido</th>
          <th className="p-2">Ativa</th><th className="p-2">Origem</th><th className="p-2">Observação</th><th className="p-2"></th>
        </tr></thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.id} className="border-t">
              <td className="p-2">{l.competencia?.slice(0, 7)}</td>
              <td className="p-2"><input type="date" defaultValue={l.vencimento} onBlur={(e) => patch(l.id, 'vencimento', e.target.value)} className="rounded border px-1" /></td>
              <td className="p-2"><input type="number" step="0.01" defaultValue={l.valor_devido} onBlur={(e) => patch(l.id, 'valor_devido', Number(e.target.value))} className="w-24 rounded border px-1" /></td>
              <td className="p-2"><input aria-label={`ativa ${l.competencia}`} type="checkbox" checked={l.ativa} onChange={(e) => patch(l.id, 'ativa', e.target.checked)} /></td>
              <td className="p-2"><span className="rounded bg-neutral-100 px-1.5 text-xs">{l.origem}</span></td>
              <td className="p-2"><input defaultValue={l.observacao || ''} onBlur={(e) => patch(l.id, 'observacao', e.target.value || null)} className="w-40 rounded border px-1" /></td>
              <td className="p-2">{l.origem === 'manual' && <button onClick={() => remover(l.id)} className="text-xs text-red-600">Remover</button>}</td>
            </tr>
          ))}
          {linhas.length === 0 && <tr><td colSpan="7" className="p-3 text-neutral-500">Nenhuma parcela. Gere a série a partir dos parâmetros.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
