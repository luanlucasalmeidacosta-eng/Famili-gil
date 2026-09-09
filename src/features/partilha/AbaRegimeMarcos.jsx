import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'

const VAZIO = {
  regime_bens: 'comunhao_parcial', data_casamento: '', data_separacao_fato: '',
  separacao_fato_efeito: 'corta_comunicacao', data_ajuizamento: '',
  // Jurisdição: alimenta a biblioteca de alíquotas (pré-preenchimento e sync
  // do enquadramento tributário na aba Cenários). Sem isso, aquele fluxo é inerte.
  uf: '', municipio: '',
}

export default function AbaRegimeMarcos({ caso }) {
  const [f, setF] = useState(VAZIO)
  const [msg, setMsg] = useState('')
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))

  useEffect(() => {
    supabase.from('partilha_config').select('*').eq('caso_id', caso.id).maybeSingle()
      .then(({ data }) => {
        if (!data) return
        // `select('*')` já traz uf/municipio (migration 0004a); NULL vira '' pra
        // manter os inputs controlados.
        setF({ ...VAZIO, ...data, uf: data.uf || '', municipio: data.municipio || '' })
      })
  }, [caso.id])

  async function salvar(e) {
    e.preventDefault()
    setMsg('')
    const row = {
      caso_id: caso.id,
      regime_bens: f.regime_bens,
      data_casamento: f.data_casamento,
      data_separacao_fato: f.data_separacao_fato || null,
      separacao_fato_efeito: f.separacao_fato_efeito,
      data_ajuizamento: f.data_ajuizamento || null,
      uf: f.uf ? f.uf.toUpperCase() : null,
      municipio: f.municipio || null,
    }
    const { error } = await supabase.from('partilha_config').upsert(row, { onConflict: 'caso_id' })
    setMsg(error ? `Erro: ${error.message}` : 'Regime e marcos salvos.')
  }

  return (
    <form onSubmit={salvar} className="grid max-w-md gap-3 text-sm">
      <label>Regime de bens
        <select value={f.regime_bens} onChange={set('regime_bens')} className="mt-1 w-full rounded border px-2 py-1">
          <option value="comunhao_parcial">Comunhão parcial de bens</option>
          <option value="comunhao_universal">Comunhão universal de bens</option>
          <option value="separacao_total">Separação convencional total</option>
          <option value="participacao_final_aquestos">Participação final nos aquestos</option>
        </select>
      </label>
      <label>Data do casamento
        <input type="date" value={f.data_casamento} onChange={set('data_casamento')} required className="mt-1 w-full rounded border px-2 py-1" />
      </label>
      <label>Data da separação de fato (opcional)
        <input type="date" value={f.data_separacao_fato} onChange={set('data_separacao_fato')} className="mt-1 w-full rounded border px-2 py-1" />
      </label>
      {f.data_separacao_fato && (
        <label>Efeito da separação de fato
          <select value={f.separacao_fato_efeito} onChange={set('separacao_fato_efeito')} className="mt-1 w-full rounded border px-2 py-1">
            <option value="corta_comunicacao">Corta a comunhão (bens depois não comunicam)</option>
            <option value="apenas_alerta">Só alerta (não altera o acervo)</option>
          </select>
        </label>
      )}
      <label>Data do ajuizamento (opcional)
        <input type="date" value={f.data_ajuizamento} onChange={set('data_ajuizamento')} className="mt-1 w-full rounded border px-2 py-1" />
      </label>
      <label>UF (opcional)
        <input value={f.uf} onChange={set('uf')} maxLength={2} className="mt-1 w-full rounded border px-2 py-1" />
      </label>
      <label>Município (opcional)
        <input value={f.municipio} onChange={set('municipio')} className="mt-1 w-full rounded border px-2 py-1" />
      </label>
      <button type="submit" className="rounded bg-neutral-900 px-3 py-1.5 text-white">Salvar</button>
      {msg && <p role="status" className="text-neutral-600">{msg}</p>}
    </form>
  )
}
