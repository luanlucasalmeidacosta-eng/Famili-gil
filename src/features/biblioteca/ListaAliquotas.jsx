import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { validarFaixasItcmd, montarFaixasItcmd } from './tributos.js'
import { Button, Card, Field, Input, Alert, EmptyState } from '../../components/ui.jsx'

const VAZIO_ITBI = { uf: '', municipio: '', aliquota: '', norma: '', fonte_url: '', observacao: '' }
const VAZIO_ITCMD = { uf: '', norma: '', fonte_url: '', observacao: '', faixas: [{ ate: '', aliquota: '' }, { ate: '', aliquota: '' }] }

export default function ListaAliquotas({ tipo }) {
  const [linhas, setLinhas] = useState([])
  const [abrindo, setAbrindo] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(tipo === 'itbi' ? VAZIO_ITBI : VAZIO_ITCMD)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    const { data } = await supabase.from('aliquotas_biblioteca').select('*').eq('tipo', tipo).order('uf')
    setLinhas(data || [])
  }, [tipo])
  useEffect(() => { carregar() }, [carregar])

  function novo() {
    setEditId(null)
    setForm(tipo === 'itbi' ? { ...VAZIO_ITBI } : { ...VAZIO_ITCMD, faixas: [{ ate: '', aliquota: '' }, { ate: '', aliquota: '' }] })
    setErro('')
    setAbrindo(true)
  }

  function editar(l) {
    setEditId(l.id)
    setErro('')
    if (tipo === 'itbi') {
      setForm({ uf: l.uf, municipio: l.municipio || '', aliquota: String(l.aliquota ?? ''), norma: l.norma || '', fonte_url: l.fonte_url || '', observacao: l.observacao || '' })
    } else {
      const faixas = (l.faixas || []).map((f) => ({ ate: f.ate == null ? '' : String(f.ate), aliquota: String(f.aliquota) }))
      setForm({ uf: l.uf, norma: l.norma || '', fonte_url: l.fonte_url || '', observacao: l.observacao || '', faixas: faixas.length ? faixas : [{ ate: '', aliquota: '' }] })
    }
    setAbrindo(true)
  }

  function setFaixa(i, campo, valor) {
    setForm((f) => ({ ...f, faixas: f.faixas.map((x, idx) => (idx === i ? { ...x, [campo]: valor } : x)) }))
  }
  const addFaixa = () => setForm((f) => ({ ...f, faixas: [...f.faixas, { ate: '', aliquota: '' }] }))
  const rmFaixa = (i) => setForm((f) => ({ ...f, faixas: f.faixas.filter((_, idx) => idx !== i) }))

  // Mesma normalização usada pelo editor de faixas da aba Cenários.
  const montarFaixas = () => montarFaixasItcmd(form.faixas)

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    let linha
    if (tipo === 'itbi') {
      const restoItbi = form.uf && form.municipio && form.norma
      const aliq = Number(form.aliquota)
      if ((form.aliquota === '' && restoItbi) || (form.aliquota !== '' && (Number.isNaN(aliq) || aliq < 0))) {
        setErro('Informe uma alíquota de ITBI válida (≥ 0).')
        return
      }
      if (!form.uf || !form.municipio || form.aliquota === '' || !form.norma) {
        setErro('Preencha UF, município, alíquota e norma.')
        return
      }
      linha = {
        tipo: 'itbi', uf: form.uf.toUpperCase(), municipio: form.municipio,
        aliquota: Number(form.aliquota), faixas: [], norma: form.norma,
        fonte_url: form.fonte_url || null, observacao: form.observacao || null,
      }
    } else {
      // Validar alíquotas em branco em linhas preenchidas, antes de montarFaixas
      for (let i = 0; i < form.faixas.length; i++) {
        const x = form.faixas[i]
        const ehPreenchida = x.ate !== '' || x.aliquota !== ''
        if (ehPreenchida && x.aliquota === '') {
          setErro(`Faixa ${i + 1}: informe a alíquota.`)
          return
        }
      }
      const faixas = montarFaixas()
      const v = validarFaixasItcmd(faixas)
      if (!v.ok) { setErro(v.motivo); return }
      if (!form.uf || !form.norma) { setErro('Preencha UF e norma.'); return }
      linha = {
        tipo: 'itcmd', uf: form.uf.toUpperCase(), municipio: null, aliquota: null,
        faixas, norma: form.norma, fonte_url: form.fonte_url || null, observacao: form.observacao || null,
      }
    }
    const resp = editId
      ? await supabase.from('aliquotas_biblioteca').update({ ...linha, atualizado_em: new Date().toISOString() }).eq('id', editId)
      : await supabase.from('aliquotas_biblioteca').insert(linha)
    if (resp.error) { setErro(resp.error.message); return }
    setAbrindo(false)
    carregar()
  }

  async function excluir(id) {
    await supabase.from('aliquotas_biblioteca').delete().eq('id', id)
    carregar()
  }

  return (
    <div className="text-sm">
      <div className="mb-2">
        <Button size="sm" onClick={novo}>+ Adicionar</Button>
      </div>

      <Card className="divide-y divide-slate-100">
        {linhas.map((l) => (
          <div key={l.id} className="flex items-center justify-between gap-3 px-3 py-2">
            <div className="min-w-0">
              <span className="font-medium text-slate-900">
                {tipo === 'itbi' ? `${l.municipio} / ${l.uf}` : l.uf}
              </span>
              <span className="ml-2 text-slate-500">
                {tipo === 'itbi'
                  ? `${l.aliquota} %`
                  : `${(l.faixas || []).length} faixa(s)`}
                {' — '}{l.norma}
              </span>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="secondary" onClick={() => editar(l)}>Editar</Button>
              <Button size="sm" variant="danger" onClick={() => excluir(l.id)}>Excluir</Button>
            </div>
          </div>
        ))}
        {linhas.length === 0 && <div className="p-2"><EmptyState>Nenhuma alíquota cadastrada.</EmptyState></div>}
      </Card>

      {abrindo && (
        <form onSubmit={salvar} className="mt-3 grid max-w-md gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <Field label="UF"><Input value={form.uf} onChange={(e) => setForm((f) => ({ ...f, uf: e.target.value }))} maxLength={2} required /></Field>
          {tipo === 'itbi' && (
            <>
              <Field label="Município"><Input value={form.municipio} onChange={(e) => setForm((f) => ({ ...f, municipio: e.target.value }))} required /></Field>
              {/* sem `required` no HTML: a guarda de range em `salvar` dá a mensagem certa (≥ 0) */}
              <Field label="Alíquota (%)"><Input type="number" step="0.01" value={form.aliquota} onChange={(e) => setForm((f) => ({ ...f, aliquota: e.target.value }))} /></Field>
            </>
          )}
          {tipo === 'itcmd' && (
            <fieldset className="rounded-lg border border-slate-200 p-2">
              <legend className="px-1 text-xs text-slate-500">Faixas progressivas (a última é sempre aberta)</legend>
              {form.faixas.map((x, i) => {
                const ehUltima = i === form.faixas.length - 1
                return (
                  <div key={i} className="flex items-center gap-2 py-1">
                    <label className="text-xs text-slate-600">
                      {ehUltima ? 'acima do teto anterior' : `Teto da faixa ${i + 1}`}
                      {!ehUltima && (
                        <Input aria-label={`Teto da faixa ${i + 1}`} type="number" step="0.01"
                          value={x.ate} onChange={(e) => setFaixa(i, 'ate', e.target.value)} className="w-32" />
                      )}
                    </label>
                    <label className="text-xs text-slate-600">
                      {`Alíquota da faixa ${i + 1} (%)`}
                      <Input aria-label={`Alíquota da faixa ${i + 1}`} type="number" step="0.01"
                        value={x.aliquota} onChange={(e) => setFaixa(i, 'aliquota', e.target.value)} className="w-24" />
                    </label>
                    {form.faixas.length > 1 && (
                      <Button type="button" size="sm" variant="ghost" onClick={() => rmFaixa(i)}>×</Button>
                    )}
                  </div>
                )
              })}
              <Button type="button" size="sm" variant="ghost" onClick={addFaixa}>+ faixa</Button>
            </fieldset>
          )}
          <Field label="Norma"><Input value={form.norma} onChange={(e) => setForm((f) => ({ ...f, norma: e.target.value }))} required /></Field>
          <Field label="Fonte (URL, opcional)"><Input value={form.fonte_url} onChange={(e) => setForm((f) => ({ ...f, fonte_url: e.target.value }))} /></Field>
          {erro && <Alert>{erro}</Alert>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAbrindo(false)}>Cancelar</Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      )}
    </div>
  )
}
