import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { apiFetch } from '../../lib/api.js'
import { classificarBem } from './classificar.js'

export default function AbaCenarios({ caso }) {
  const [bens, setBens] = useState([])
  const [config, setConfig] = useState(null)
  const [cenarios, setCenarios] = useState([])
  const [rotulo, setRotulo] = useState('')
  const [pctParteA, setPctParteA] = useState(50)
  const [alocacoes, setAlocacoes] = useState({}) // bemId -> { para, fracaoA }
  const [tornas, setTornas] = useState([])
  const [versoesPorCenario, setVersoesPorCenario] = useState({}) // cenarioId -> [versao, ...] desc
  const [msg, setMsg] = useState('')

  const carregar = useCallback(async () => {
    const { data: b } = await supabase.from('partilha_bens').select('*').eq('caso_id', caso.id).order('descricao')
    setBens(b || [])
    const { data: c } = await supabase.from('partilha_config').select('*').eq('caso_id', caso.id).maybeSingle()
    setConfig(c || null)
    const { data: cs } = await supabase.from('partilha_cenarios').select('*').eq('caso_id', caso.id).order('criado_em', { ascending: false })
    setCenarios(cs || [])
    const { data: mem } = await supabase.from('partilha_memoria').select('versao, cenario_id').eq('caso_id', caso.id).order('versao', { ascending: false })
    const porCenario = {}
    for (const m of mem || []) (porCenario[m.cenario_id] ||= []).push(m.versao)
    setVersoesPorCenario(porCenario)
  }, [caso.id])
  useEffect(() => { carregar() }, [carregar])

  function ehComunicavelOuAquesto(bem) {
    if (!config) return false
    const c = classificarBem({
      bem: { formaAquisicao: bem.forma_aquisicao, dataAquisicao: bem.data_aquisicao, clausulaIncomunicabilidade: bem.clausula_incomunicabilidade, titular: bem.titular, classificacaoOverride: bem.classificacao_override },
      regimeBens: config.regime_bens,
      // dataAjuizamento incluída pelos mesmos motivos de AbaBens: paridade com o servidor.
      marcos: { dataCasamento: config.data_casamento, dataSeparacaoFato: config.data_separacao_fato, separacaoFatoEfeito: config.separacao_fato_efeito, dataAjuizamento: config.data_ajuizamento || null },
    })
    return c.classificacao === 'comunicavel' || c.classificacao.startsWith('aquesto')
  }

  function adicionarTorna() {
    setTornas((t) => [...t, { de: 'parte_a', para: 'parte_b', valor: 0, forma: 'dinheiro' }])
  }
  function atualizarTorna(i, campo, valor) {
    setTornas((t) => t.map((x, idx) => (idx === i ? { ...x, [campo]: valor } : x)))
  }

  async function salvarCenario(e) {
    e.preventDefault()
    setMsg('')
    const alocacoesArr = Object.entries(alocacoes).map(([bemId, a]) => ({ bemId, para: a.para, fracaoA: a.fracaoA }))
    const { error } = await supabase.from('partilha_cenarios').insert({
      caso_id: caso.id, rotulo, pct_parte_a: Number(pctParteA), alocacoes: alocacoesArr, tornas,
    })
    setMsg(error ? `Erro: ${error.message}` : 'Cenário salvo.')
    if (!error) { setRotulo(''); setAlocacoes({}); setTornas([]) }
    carregar()
  }

  async function calcular(cenarioId) {
    setMsg('')
    try {
      await apiFetch('/api/partilha/calcular', { method: 'POST', body: { casoId: caso.id, cenarioId } })
      setMsg('Cenário calculado. Veja a aba Memória de partilha.')
    } catch (err) { setMsg(err.message) }
  }

  const bensAlocaveis = bens.filter(ehComunicavelOuAquesto)

  return (
    <div className="text-sm">
      <form onSubmit={salvarCenario} className="mb-6 grid max-w-lg gap-3">
        <label>Rótulo
          <input value={rotulo} onChange={(e) => setRotulo(e.target.value)} required className="mt-1 w-full rounded border px-2 py-1" />
        </label>
        <label>Percentual da parte A (%)
          <input type="number" value={pctParteA} onChange={(e) => setPctParteA(e.target.value)} className="mt-1 w-full rounded border px-2 py-1" />
        </label>
        <fieldset className="rounded border p-2">
          <legend className="px-1 text-xs text-neutral-500">Alocação dos bens comunicáveis</legend>
          {bensAlocaveis.map((bem) => (
            <div key={bem.id} className="flex items-center gap-2 py-1">
              <span className="w-40">{bem.descricao}</span>
              <select
                value={alocacoes[bem.id]?.para || ''}
                onChange={(e) => setAlocacoes((a) => ({ ...a, [bem.id]: { ...a[bem.id], para: e.target.value } }))}
                className="rounded border px-1 text-xs"
              >
                <option value="">— alocar —</option>
                <option value="parte_a">Parte A</option>
                <option value="parte_b">Parte B</option>
                <option value="condominio">Condomínio</option>
              </select>
              {alocacoes[bem.id]?.para === 'condominio' && (
                <input
                  type="number" step="0.01" placeholder="fração de A (0-1)"
                  value={alocacoes[bem.id]?.fracaoA ?? ''}
                  onChange={(e) => setAlocacoes((a) => ({ ...a, [bem.id]: { ...a[bem.id], fracaoA: Number(e.target.value) } }))}
                  className="w-28 rounded border px-1 text-xs"
                />
              )}
            </div>
          ))}
          {bensAlocaveis.length === 0 && <p className="text-neutral-500">Nenhum bem comunicável ainda.</p>}
        </fieldset>
        <fieldset className="rounded border p-2">
          <legend className="px-1 text-xs text-neutral-500">Tornas informadas</legend>
          {tornas.map((t, i) => (
            <div key={i} className="flex items-center gap-2 py-1">
              <select value={t.de} onChange={(e) => atualizarTorna(i, 'de', e.target.value)} className="rounded border px-1 text-xs">
                <option value="parte_a">Parte A</option><option value="parte_b">Parte B</option>
              </select>
              <span>→</span>
              <select value={t.para} onChange={(e) => atualizarTorna(i, 'para', e.target.value)} className="rounded border px-1 text-xs">
                <option value="parte_a">Parte A</option><option value="parte_b">Parte B</option>
              </select>
              <input type="number" step="0.01" value={t.valor} onChange={(e) => atualizarTorna(i, 'valor', Number(e.target.value))} className="w-28 rounded border px-1 text-xs" />
              <select value={t.forma} onChange={(e) => atualizarTorna(i, 'forma', e.target.value)} className="rounded border px-1 text-xs">
                <option value="dinheiro">Dinheiro</option><option value="bem">Bem</option><option value="sem_contrapartida">Sem contrapartida</option>
              </select>
            </div>
          ))}
          <button type="button" onClick={adicionarTorna} className="mt-1 text-xs text-blue-600">+ Adicionar torna</button>
        </fieldset>
        <button type="submit" className="rounded bg-neutral-900 px-3 py-1.5 text-white">Salvar cenário</button>
        {msg && <p role="status" className="text-neutral-600">{msg}</p>}
      </form>

      <ul className="divide-y rounded border">
        {cenarios.map((c) => (
          <li key={c.id} className="flex items-center justify-between p-2">
            <span>
              {c.rotulo} ({c.pct_parte_a}% / {100 - c.pct_parte_a}%)
              <span className="ml-2 text-xs text-neutral-500">
                {versoesPorCenario[c.id]?.length
                  ? `versões calculadas: ${versoesPorCenario[c.id].slice().sort((a, b) => a - b).map((v) => `v${v}`).join(', ')} — abra na aba Memória de partilha`
                  : 'ainda não calculado'}
              </span>
            </span>
            <button onClick={() => calcular(c.id)} className="rounded border px-2 py-1 text-xs">Calcular</button>
          </li>
        ))}
        {cenarios.length === 0 && <li className="p-3 text-neutral-500">Nenhum cenário criado.</li>}
      </ul>
    </div>
  )
}
