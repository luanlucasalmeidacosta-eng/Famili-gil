import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { apiFetch } from '../../lib/api.js'
import { validarFaixasItcmd } from '../biblioteca/tributos.js'
import { Button, Field, Input } from '../../components/ui.jsx'
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
  const [aliquotasBib, setAliquotasBib] = useState([])
  const [trib, setTrib] = useState({
    itbiAliquota: '', itbiNorma: '',
    itcmdFaixas: [{ ate: '', aliquota: '' }, { ate: '', aliquota: '' }], itcmdNorma: '',
    valorItbiManual: '', valorItcmdManual: '',
  })
  const [conflito, setConflito] = useState(null) // { tipo, existente, novo } | null

  const carregar = useCallback(async () => {
    const { data: b } = await supabase.from('partilha_bens').select('*').eq('caso_id', caso.id).order('descricao')
    setBens(b || [])
    const { data: c } = await supabase.from('partilha_config').select('*').eq('caso_id', caso.id).maybeSingle()
    setConfig(c || null)
    const { data: bib } = await supabase.from('aliquotas_biblioteca').select('*')
    setAliquotasBib(bib || [])
    const { data: cs } = await supabase.from('partilha_cenarios').select('*').eq('caso_id', caso.id).order('criado_em', { ascending: false })
    setCenarios(cs || [])
    const { data: mem } = await supabase.from('partilha_memoria').select('versao, cenario_id').eq('caso_id', caso.id).order('versao', { ascending: false })
    const porCenario = {}
    for (const m of mem || []) (porCenario[m.cenario_id] ||= []).push(m.versao)
    setVersoesPorCenario(porCenario)
  }, [caso.id])
  useEffect(() => { carregar() }, [carregar])

  // Pré-preenche a seção tributária a partir da biblioteca, casando por (tipo, uf, municipio).
  useEffect(() => {
    if (!config) return
    const uf = (config.uf || '').toUpperCase()
    const itbi = aliquotasBib.find((a) => a.tipo === 'itbi' && a.uf === uf && a.municipio === config.municipio)
    const itcmd = aliquotasBib.find((a) => a.tipo === 'itcmd' && a.uf === uf)
    setTrib((t) => ({
      ...t,
      itbiAliquota: itbi ? String(itbi.aliquota) : t.itbiAliquota,
      itbiNorma: itbi ? itbi.norma : t.itbiNorma,
      itcmdNorma: itcmd ? itcmd.norma : t.itcmdNorma,
      itcmdFaixas: itcmd
        ? (itcmd.faixas || []).map((f) => ({ ate: f.ate == null ? '' : String(f.ate), aliquota: String(f.aliquota) }))
        : t.itcmdFaixas,
    }))
  }, [config, aliquotasBib])

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

  const setFaixaItcmd = (i, campo, valor) =>
    setTrib((t) => ({ ...t, itcmdFaixas: t.itcmdFaixas.map((x, idx) => (idx === i ? { ...x, [campo]: valor } : x)) }))
  const addFaixaItcmd = () => setTrib((t) => ({ ...t, itcmdFaixas: [...t.itcmdFaixas, { ate: '', aliquota: '' }] }))
  const rmFaixaItcmd = (i) => setTrib((t) => ({ ...t, itcmdFaixas: t.itcmdFaixas.filter((_, idx) => idx !== i) }))

  // Lição da Task 8: uma faixa "preenchida" (teto OU alíquota não-vazios) com alíquota em
  // branco não pode virar 0% silencioso — rejeita antes de gravar.
  function erroFaixasItcmd() {
    for (let i = 0; i < trib.itcmdFaixas.length; i++) {
      const x = trib.itcmdFaixas[i]
      if ((x.ate !== '' || x.aliquota !== '') && x.aliquota === '') {
        return `Faixa ${i + 1} do ITCMD: informe a alíquota.`
      }
    }
    return null
  }

  function montarTributarioInput() {
    const out = { itbi: null, itcmd: null, valorItbiManual: null, valorItcmdManual: null }
    if (trib.itbiAliquota !== '' && trib.itbiNorma) {
      out.itbi = { aliquota: Number(trib.itbiAliquota), norma: trib.itbiNorma }
    }
    const faixas = trib.itcmdFaixas.map((x, idx) => ({
      ate: idx === trib.itcmdFaixas.length - 1 ? null : Number(x.ate),
      aliquota: Number(x.aliquota),
    }))
    if (trib.itcmdNorma && validarFaixasItcmd(faixas).ok) {
      out.itcmd = { faixas, norma: trib.itcmdNorma }
    }
    if (trib.valorItbiManual !== '') out.valorItbiManual = Number(trib.valorItbiManual)
    if (trib.valorItcmdManual !== '') out.valorItcmdManual = Number(trib.valorItcmdManual)
    return out
  }

  async function sincronizarBiblioteca(tributarioInput) {
    const uf = (config?.uf || '').toUpperCase()
    if (!uf) return
    if (tributarioInput.itbi && config?.municipio) {
      const existente = aliquotasBib.find((a) => a.tipo === 'itbi' && a.uf === uf && a.municipio === config.municipio)
      if (!existente) {
        await supabase.from('aliquotas_biblioteca').insert({
          tipo: 'itbi', uf, municipio: config.municipio,
          aliquota: tributarioInput.itbi.aliquota, faixas: [], norma: tributarioInput.itbi.norma,
        })
      } else if (existente.aliquota !== tributarioInput.itbi.aliquota || existente.norma !== tributarioInput.itbi.norma) {
        setConflito({ tipo: 'itbi', existente, novo: tributarioInput.itbi })
      }
    }
    if (tributarioInput.itcmd) {
      const existente = aliquotasBib.find((a) => a.tipo === 'itcmd' && a.uf === uf)
      if (!existente) {
        await supabase.from('aliquotas_biblioteca').insert({
          tipo: 'itcmd', uf, municipio: null, aliquota: null,
          faixas: tributarioInput.itcmd.faixas, norma: tributarioInput.itcmd.norma,
        })
      } else if (JSON.stringify(existente.faixas) !== JSON.stringify(tributarioInput.itcmd.faixas) || existente.norma !== tributarioInput.itcmd.norma) {
        setConflito({ tipo: 'itcmd', existente, novo: tributarioInput.itcmd })
      }
    }
  }

  async function confirmarAtualizacaoBiblioteca() {
    if (!conflito) return
    const patch = conflito.tipo === 'itbi'
      ? { aliquota: conflito.novo.aliquota, norma: conflito.novo.norma }
      : { faixas: conflito.novo.faixas, norma: conflito.novo.norma }
    await supabase.from('aliquotas_biblioteca').update(patch).eq('id', conflito.existente.id)
    setConflito(null)
    carregar()
  }

  async function salvarCenario(e) {
    e.preventDefault()
    setMsg('')
    const errFaixas = erroFaixasItcmd()
    if (errFaixas) { setMsg(`Erro: ${errFaixas}`); return }
    const alocacoesArr = Object.entries(alocacoes).map(([bemId, a]) => ({ bemId, para: a.para, fracaoA: a.fracaoA }))
    const tributarioInput = montarTributarioInput()
    const { error } = await supabase.from('partilha_cenarios').insert({
      caso_id: caso.id, rotulo, pct_parte_a: Number(pctParteA), alocacoes: alocacoesArr, tornas,
      tributario_input: tributarioInput,
    })
    setMsg(error ? `Erro: ${error.message}` : 'Cenário salvo.')
    if (!error) {
      setRotulo(''); setAlocacoes({}); setTornas([])
      await sincronizarBiblioteca(tributarioInput)
    }
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

        <fieldset className="rounded-lg border border-slate-200 p-3">
          <legend className="px-1 text-xs font-medium text-slate-500">Enquadramento tributário</legend>
          <div className="grid gap-3">
            <Field label="Alíquota de ITBI (%)">
              <Input aria-label="Alíquota de ITBI" type="number" step="0.01"
                value={trib.itbiAliquota}
                onChange={(e) => setTrib((t) => ({ ...t, itbiAliquota: e.target.value }))} />
            </Field>
            <Field label="Norma do ITBI">
              <Input aria-label="Norma do ITBI" value={trib.itbiNorma}
                onChange={(e) => setTrib((t) => ({ ...t, itbiNorma: e.target.value }))} />
            </Field>

            <fieldset className="rounded-lg border border-slate-200 p-2">
              <legend className="px-1 text-xs text-slate-500">Faixas progressivas do ITCMD (a última é sempre aberta)</legend>
              {trib.itcmdFaixas.map((x, i) => {
                const ehUltima = i === trib.itcmdFaixas.length - 1
                return (
                  <div key={i} className="flex items-end gap-2 py-1">
                    {!ehUltima ? (
                      <Field label={`Teto da faixa ${i + 1}`} className="text-xs">
                        <Input aria-label={`Teto da faixa ${i + 1}`} type="number" step="0.01"
                          value={x.ate} onChange={(e) => setFaixaItcmd(i, 'ate', e.target.value)} className="w-32" />
                      </Field>
                    ) : (
                      <span className="pb-2 text-xs text-slate-500">acima do teto anterior</span>
                    )}
                    <Field label={`Alíquota da faixa ${i + 1} (%)`} className="text-xs">
                      <Input aria-label={`Alíquota da faixa ${i + 1}`} type="number" step="0.01"
                        value={x.aliquota} onChange={(e) => setFaixaItcmd(i, 'aliquota', e.target.value)} className="w-24" />
                    </Field>
                    {trib.itcmdFaixas.length > 1 && (
                      <Button type="button" size="sm" variant="ghost" onClick={() => rmFaixaItcmd(i)}>×</Button>
                    )}
                  </div>
                )
              })}
              <Button type="button" size="sm" variant="ghost" onClick={addFaixaItcmd}>+ faixa</Button>
            </fieldset>

            <Field label="Norma do ITCMD">
              <Input aria-label="Norma do ITCMD" value={trib.itcmdNorma}
                onChange={(e) => setTrib((t) => ({ ...t, itcmdNorma: e.target.value }))} />
            </Field>
            <Field label="Valor de ITBI (manual, opcional)">
              <Input aria-label="Valor de ITBI (manual)" type="number" step="0.01"
                value={trib.valorItbiManual}
                onChange={(e) => setTrib((t) => ({ ...t, valorItbiManual: e.target.value }))} />
            </Field>
            <Field label="Valor de ITCMD (manual, opcional)">
              <Input aria-label="Valor de ITCMD (manual)" type="number" step="0.01"
                value={trib.valorItcmdManual}
                onChange={(e) => setTrib((t) => ({ ...t, valorItcmdManual: e.target.value }))} />
            </Field>
          </div>
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

      {conflito && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-sm space-y-3 rounded-2xl bg-white p-5 text-sm shadow-lg">
            <p>Já existe uma alíquota de <strong>{conflito.tipo.toUpperCase()}</strong> na biblioteca para esta jurisdição, com valor diferente.</p>
            <p className="text-slate-500">Atualizar a biblioteca com o valor deste cenário?</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setConflito(null)}>Manter o da biblioteca</Button>
              <Button type="button" onClick={confirmarAtualizacaoBiblioteca}>Atualizar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
