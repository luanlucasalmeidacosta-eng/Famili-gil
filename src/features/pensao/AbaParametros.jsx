import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'

const VAZIO = {
  tipo_valor: 'fixo', valor_base: '', salario_minimo_ref: '', rendimento_ref: '',
  dia_vencimento: '', data_inicial: '', data_final: '',
  indice_correcao: 'legal', regra_imputacao: 'mais_antigas_primeiro',
  regime_juros_convencionado: '1_am_simples',
}

export default function AbaParametros({ caso }) {
  const [f, setF] = useState(VAZIO)
  const [msg, setMsg] = useState('')
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))

  useEffect(() => {
    supabase.from('pensao_parametros').select('*').eq('caso_id', caso.id).maybeSingle()
      .then(({ data }) => { if (data) setF({ ...VAZIO, ...data }) })
  }, [caso.id])

  async function salvar(e) {
    e.preventDefault()
    setMsg('')
    const row = {
      caso_id: caso.id,
      tipo_valor: f.tipo_valor,
      valor_base: Number(f.valor_base),
      salario_minimo_ref: f.salario_minimo_ref === '' ? null : Number(f.salario_minimo_ref),
      rendimento_ref: f.rendimento_ref === '' ? null : Number(f.rendimento_ref),
      dia_vencimento: Number(f.dia_vencimento),
      data_inicial: f.data_inicial,
      data_final: f.data_final,
      indice_correcao: f.indice_correcao,
      regra_imputacao: f.regra_imputacao,
      regime_juros_convencionado: f.regime_juros_convencionado,
    }
    const { error } = await supabase.from('pensao_parametros').upsert(row, { onConflict: 'caso_id' })
    setMsg(error ? `Erro: ${error.message}` : 'Parâmetros salvos.')
  }

  return (
    <form onSubmit={salvar} className="grid max-w-md gap-3 text-sm">
      <label>Tipo de valor
        <select value={f.tipo_valor} onChange={set('tipo_valor')} className="mt-1 w-full rounded border px-2 py-1">
          <option value="fixo">Valor fixo (R$)</option>
          <option value="pct_salario_minimo">% do salário mínimo</option>
          <option value="pct_rendimento">% do rendimento</option>
        </select>
      </label>
      <label>Valor {f.tipo_valor === 'fixo' ? '(R$)' : '(%)'}
        <input aria-label="valor" type="number" step="0.01" value={f.valor_base} onChange={set('valor_base')} className="mt-1 w-full rounded border px-2 py-1" />
      </label>
      {f.tipo_valor === 'pct_salario_minimo' && (
        <label>Salário mínimo de referência (R$)
          <input type="number" step="0.01" value={f.salario_minimo_ref} onChange={set('salario_minimo_ref')} className="mt-1 w-full rounded border px-2 py-1" />
        </label>
      )}
      {f.tipo_valor === 'pct_rendimento' && (
        <label>Rendimento de referência (R$)
          <input type="number" step="0.01" value={f.rendimento_ref} onChange={set('rendimento_ref')} className="mt-1 w-full rounded border px-2 py-1" />
        </label>
      )}
      <label>Dia do vencimento
        <input type="number" min="1" max="31" value={f.dia_vencimento} onChange={set('dia_vencimento')} className="mt-1 w-full rounded border px-2 py-1" />
      </label>
      <label>Data inicial
        <input type="date" value={f.data_inicial} onChange={set('data_inicial')} className="mt-1 w-full rounded border px-2 py-1" />
      </label>
      <label>Data final
        <input type="date" value={f.data_final} onChange={set('data_final')} className="mt-1 w-full rounded border px-2 py-1" />
      </label>
      <label>Índice de correção
        <select value={f.indice_correcao} onChange={set('indice_correcao')} className="mt-1 w-full rounded border px-2 py-1">
          <option value="legal">Legal (SELIC até 29/08/2024; IPCA + SELIC líquida depois)</option>
          <option value="INPC">INPC</option>
          <option value="IGPM">IGP-M</option>
          <option value="IPCA-E">IPCA-E</option>
          <option value="IPCA">IPCA</option>
        </select>
      </label>
      {f.indice_correcao !== 'legal' && (
        <label>Regime de juros (índice convencionado)
          <select value={f.regime_juros_convencionado} onChange={set('regime_juros_convencionado')} className="mt-1 w-full rounded border px-2 py-1">
            <option value="1_am_simples">1% ao mês, simples</option>
            <option value="1_am_capitalizado">1% ao mês, capitalizado</option>
            <option value="selic">SELIC</option>
          </select>
        </label>
      )}
      <label>Regra de imputação de pagamento
        <select value={f.regra_imputacao} onChange={set('regra_imputacao')} className="mt-1 w-full rounded border px-2 py-1">
          <option value="mais_antigas_primeiro">Parcelas mais antigas primeiro</option>
          <option value="mais_recentes_primeiro">Parcelas mais recentes primeiro</option>
          <option value="pro_rata">Pró-rata entre as parcelas em aberto</option>
        </select>
      </label>
      <button type="submit" className="rounded bg-neutral-900 px-3 py-1.5 text-white">Salvar</button>
      {msg && <p role="status" className="text-neutral-600">{msg}</p>}
    </form>
  )
}
