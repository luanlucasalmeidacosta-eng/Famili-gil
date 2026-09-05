import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { classificarBem } from './classificar.js'

const TIPOS = ['imovel', 'veiculo', 'conta', 'investimento', 'empresa', 'movel', 'outro']
const FORMAS = ['oneroso', 'doacao', 'heranca', 'legado', 'sub_rogacao', 'fato_eventual', 'beneficiaria_particular']
const ROTULO_CLASSIFICACAO = {
  comunicavel: 'Comunicável', particular: 'Particular', pendente: 'Pendente',
  aquesto_a: 'Aquesto de A', aquesto_b: 'Aquesto de B', fora_aquestos: 'Fora dos aquestos',
}

const VAZIO = {
  descricao: '', tipo: 'imovel', valorMercado: '', dataAquisicao: '', formaAquisicao: '',
  clausulaIncomunicabilidade: false, titular: 'parte_a', financiado: false, saldoDevedor: '', observacao: '',
}

export default function AbaBens({ caso }) {
  const [bens, setBens] = useState([])
  const [config, setConfig] = useState(null)
  const [f, setF] = useState(VAZIO)
  const [msg, setMsg] = useState('')

  const carregar = useCallback(async () => {
    const { data: b } = await supabase.from('partilha_bens').select('*').eq('caso_id', caso.id).order('descricao')
    setBens(b || [])
    const { data: c } = await supabase.from('partilha_config').select('*').eq('caso_id', caso.id).maybeSingle()
    setConfig(c || null)
  }, [caso.id])
  useEffect(() => { carregar() }, [carregar])

  function previsao(bem) {
    if (!config) return { classificacao: 'pendente', regra: 'defina o regime na aba Regime e marcos', citacao: '—' }
    return classificarBem({
      bem: {
        formaAquisicao: bem.forma_aquisicao, dataAquisicao: bem.data_aquisicao,
        clausulaIncomunicabilidade: bem.clausula_incomunicabilidade, titular: bem.titular,
        classificacaoOverride: bem.classificacao_override,
      },
      regimeBens: config.regime_bens,
      // dataAjuizamento é obrigatória aqui: sem ela o fim da constância cai no
      // sentinela 9999-12-31 e o preview do cliente diverge do veredito do servidor
      // (api/partilha/calcular.js sempre a envia) pro MESMO bem.
      marcos: {
        dataCasamento: config.data_casamento, dataSeparacaoFato: config.data_separacao_fato,
        separacaoFatoEfeito: config.separacao_fato_efeito, dataAjuizamento: config.data_ajuizamento || null,
      },
    })
  }

  async function adicionar(e) {
    e.preventDefault()
    setMsg('')
    const { error } = await supabase.from('partilha_bens').insert({
      caso_id: caso.id, descricao: f.descricao, tipo: f.tipo, valor_mercado: Number(f.valorMercado),
      data_aquisicao: f.dataAquisicao || null, forma_aquisicao: f.formaAquisicao || null,
      clausula_incomunicabilidade: f.clausulaIncomunicabilidade, titular: f.titular,
      financiado: f.financiado, saldo_devedor: f.financiado ? Number(f.saldoDevedor || 0) : null,
      observacao: f.observacao || null,
    })
    setMsg(error ? `Erro: ${error.message}` : 'Bem cadastrado.')
    if (!error) setF(VAZIO)
    carregar()
  }

  async function reclassificar(bemId, valor) {
    await supabase.from('partilha_bens').update({ classificacao_override: valor || null }).eq('id', bemId)
    carregar()
  }
  async function remover(bemId) {
    await supabase.from('partilha_bens').delete().eq('id', bemId)
    carregar()
  }

  return (
    <div className="text-sm">
      <form onSubmit={adicionar} className="mb-4 grid max-w-md gap-3">
        <label>Descrição
          <input value={f.descricao} onChange={(e) => setF((s) => ({ ...s, descricao: e.target.value }))} required className="mt-1 w-full rounded border px-2 py-1" />
        </label>
        <label>Tipo
          <select value={f.tipo} onChange={(e) => setF((s) => ({ ...s, tipo: e.target.value }))} className="mt-1 w-full rounded border px-2 py-1">
            {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label>Valor de mercado (R$)
          <input aria-label="valor de mercado" type="number" step="0.01" value={f.valorMercado} onChange={(e) => setF((s) => ({ ...s, valorMercado: e.target.value }))} required className="mt-1 w-full rounded border px-2 py-1" />
        </label>
        <label>Data de aquisição
          <input type="date" value={f.dataAquisicao} onChange={(e) => setF((s) => ({ ...s, dataAquisicao: e.target.value }))} className="mt-1 w-full rounded border px-2 py-1" />
        </label>
        <label>Forma de aquisição
          <select value={f.formaAquisicao} onChange={(e) => setF((s) => ({ ...s, formaAquisicao: e.target.value }))} className="mt-1 w-full rounded border px-2 py-1">
            <option value="">— selecione —</option>
            {FORMAS.map((fo) => <option key={fo} value={fo}>{fo}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={f.clausulaIncomunicabilidade} onChange={(e) => setF((s) => ({ ...s, clausulaIncomunicabilidade: e.target.checked }))} />
          Cláusula de incomunicabilidade
        </label>
        <label>Titular
          <select value={f.titular} onChange={(e) => setF((s) => ({ ...s, titular: e.target.value }))} className="mt-1 w-full rounded border px-2 py-1">
            <option value="parte_a">Parte A</option>
            <option value="parte_b">Parte B</option>
            <option value="ambos">Ambos</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={f.financiado} onChange={(e) => setF((s) => ({ ...s, financiado: e.target.checked }))} />
          Financiado
        </label>
        {f.financiado && (
          <label>Saldo devedor (R$)
            <input type="number" step="0.01" value={f.saldoDevedor} onChange={(e) => setF((s) => ({ ...s, saldoDevedor: e.target.value }))} className="mt-1 w-full rounded border px-2 py-1" />
          </label>
        )}
        <button type="submit" className="rounded bg-neutral-900 px-3 py-1.5 text-white">Adicionar bem</button>
        {msg && <p role="status" className="text-neutral-600">{msg}</p>}
      </form>

      <table className="w-full border">
        <thead><tr className="bg-neutral-50 text-left">
          <th className="p-2">Descrição</th><th className="p-2">Valor</th><th className="p-2">Classificação</th>
          <th className="p-2">Fundamento</th><th className="p-2">Reclassificar</th><th className="p-2"></th>
        </tr></thead>
        <tbody>
          {bens.map((bem) => {
            const p = previsao(bem)
            return (
              <tr key={bem.id} className="border-t">
                <td className="p-2">{bem.descricao}</td>
                <td className="p-2">R$ {Number(bem.valor_mercado).toFixed(2)}</td>
                <td className="p-2">{ROTULO_CLASSIFICACAO[p.classificacao] || p.classificacao}</td>
                <td className="p-2 text-xs text-neutral-600">{p.citacao}</td>
                <td className="p-2">
                  <select defaultValue={bem.classificacao_override || ''} onChange={(e) => reclassificar(bem.id, e.target.value)} className="rounded border px-1 text-xs">
                    <option value="">— automática —</option>
                    <option value="comunicavel">Forçar comunicável</option>
                    <option value="particular">Forçar particular</option>
                  </select>
                </td>
                <td className="p-2"><button onClick={() => remover(bem.id)} className="text-xs text-red-600">Remover</button></td>
              </tr>
            )
          })}
          {bens.length === 0 && <tr><td colSpan="6" className="p-3 text-neutral-500">Nenhum bem cadastrado.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
