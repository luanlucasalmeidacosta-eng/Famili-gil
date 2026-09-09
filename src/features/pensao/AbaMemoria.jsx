import { useCallback, useEffect, useState } from 'react'
import { apiFetch, apiFetchBlob } from '../../lib/api.js'
import { supabase } from '../../lib/supabase.js'
import { Button, Field, Input, Alert, Badge, EmptyState } from '../../components/ui.jsx'
import { NOTA_PROJECAO_PADRAO } from './notaProjecao.js'

const brl = (n) => `R$ ${Number(n).toFixed(2).replace('.', ',')}`

export default function AbaMemoria({ caso }) {
  const [dataBase, setDataBase] = useState('')
  const [memoria, setMemoria] = useState(null)
  const [versoes, setVersoes] = useState([])
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  const [projecao, setProjecao] = useState(false)
  const [manuais, setManuais] = useState([])
  const [nota, setNota] = useState('')
  const [indiceCaso, setIndiceCaso] = useState(null)

  const listarVersoes = useCallback(async () => {
    const { data } = await supabase.from('pensao_memoria').select('versao').eq('caso_id', caso.id).order('versao', { ascending: false })
    setVersoes((data || []).map((r) => r.versao))
  }, [caso.id])
  useEffect(() => { listarVersoes() }, [listarVersoes])

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const { data } = await supabase
          .from('pensao_parametros').select('indice_correcao, projecao_nota').eq('caso_id', caso.id).maybeSingle()
        if (vivo && data) {
          setIndiceCaso(data.indice_correcao || null)
          if (data.projecao_nota) setNota(data.projecao_nota)
        }
      } catch { /* a chamada é opcional; segue com defaults */ }
    })()
    return () => { vivo = false }
  }, [caso.id])

  async function carregarVersao(versao) {
    setErro('')
    try {
      const m = await apiFetch(`/api/pensao/memoria?casoId=${caso.id}${versao ? `&versao=${versao}` : ''}`)
      setMemoria(m)
    } catch (e) { setErro(e.message) }
  }

  async function calcular() {
    setErro(''); setCarregando(true); setMemoria(null)
    try {
      const body = { casoId: caso.id, dataBase }
      if (projecao) {
        body.permitirProjecao = true
        body.projecoesManuais = manuais
          .filter((m) => m.competencia && m.taxa !== '')
          .map((m) => ({ competencia: `${m.competencia}-01`, taxa: Number(m.taxa), fonte: m.fonte || '' }))
      }
      await apiFetch('/api/pensao/calcular', { method: 'POST', body })
      await listarVersoes()
      await carregarVersao()
    } catch (e) { setErro(e.message) } finally { setCarregando(false) }
  }

  async function salvarNota(valor) {
    try {
      await supabase.from('pensao_parametros').update({ projecao_nota: valor }).eq('caso_id', caso.id)
    } catch { /* best-effort */ }
  }

  async function exportar(formato) {
    setErro('')
    try {
      const { blob, filename } = await apiFetchBlob(
        `/api/pensao/exportar?casoId=${caso.id}&versao=${memoria.versao}&formato=${formato}`,
      )
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
    } catch (e) { setErro(e.message) }
  }

  const fundamentos = memoria ? [...new Set(memoria.linhas.flatMap((l) => l.fundamentos || []))] : []
  const versaoMaisRecente = versoes[0]
  const mostrarManual = projecao && indiceCaso && indiceCaso !== 'IPCA' && indiceCaso !== 'legal'
  const temDoisTotais = memoria && memoria.totais?.saldoAteUltimoIndiceFirme != null

  return (
    <div className="text-sm">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Data-base">
          <Input type="date" value={dataBase} onChange={(e) => setDataBase(e.target.value)} />
        </Field>
        <label className="mb-1 flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={projecao} onChange={(e) => setProjecao(e.target.checked)} />
          <span>Incluir projeção (Boletim Focus)</span>
        </label>
        <Button onClick={calcular} disabled={!dataBase || carregando}>
          {carregando ? 'Calculando…' : 'Calcular nova versão'}
        </Button>
        {memoria && (
          <span className="flex gap-2">
            <Button variant="secondary" onClick={() => exportar('docx')}>Exportar Word</Button>
            <Button variant="secondary" onClick={() => exportar('xlsx')}>Exportar planilha</Button>
          </span>
        )}
      </div>

      {mostrarManual && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="mb-2 font-medium text-amber-800">
            Projeção manual de {indiceCaso} (uma linha por mês projetado)
          </p>
          {manuais.map((m, i) => (
            <div key={i} className="mb-2 flex flex-wrap items-center gap-2">
              <Input
                type="month" className="w-40" value={m.competencia}
                onChange={(e) => setManuais(manuais.map((x, j) => (j === i ? { ...x, competencia: e.target.value } : x)))}
              />
              <Input
                type="number" step="0.01" placeholder="taxa %" className="w-28" value={m.taxa}
                onChange={(e) => setManuais(manuais.map((x, j) => (j === i ? { ...x, taxa: e.target.value } : x)))}
              />
              <Input
                placeholder="fonte" className="w-56" value={m.fonte}
                onChange={(e) => setManuais(manuais.map((x, j) => (j === i ? { ...x, fonte: e.target.value } : x)))}
              />
              <Button variant="ghost" size="sm" onClick={() => setManuais(manuais.filter((_, j) => j !== i))}>
                remover
              </Button>
            </div>
          ))}
          <Button
            variant="secondary" size="sm"
            onClick={() => setManuais([...manuais, { competencia: '', taxa: '', fonte: '' }])}
          >
            + mês
          </Button>
        </div>
      )}

      {versoes.length > 0 && (
        <div className="mb-4">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">Versões calculadas</p>
          <div className="flex flex-wrap gap-1.5">
            {versoes.map((v) => (
              <button
                key={v}
                onClick={() => carregarVersao(v)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  memoria?.versao === v
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                v{v}{v === versaoMaisRecente ? ' · atual' : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      {erro && <Alert>{erro}</Alert>}

      {!memoria && versoes.length === 0 && !erro && (
        <EmptyState>Escolha uma data-base e calcule a primeira versão da memória.</EmptyState>
      )}

      {memoria && (
        <>
          {memoria.alertas?.length > 0 && (
            <div className="mb-3">
              <Alert tone="amber">
                <ul>{memoria.alertas.map((a, i) => <li key={i}>• {a}</li>)}</ul>
              </Alert>
            </div>
          )}
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left">
              <thead><tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="p-2">Competência</th><th className="p-2">Vencimento</th><th className="p-2">Valor original</th>
                <th className="p-2">Correção</th><th className="p-2">Juros</th><th className="p-2">Pagamentos</th><th className="p-2">Saldo</th>
              </tr></thead>
              <tbody>
                {memoria.linhas.map((l) => (
                  <tr key={l.parcelaId} className={`border-t border-slate-100 ${l.projetado ? 'bg-amber-50' : ''}`}>
                    <td className="p-2">
                      {l.competencia}
                      {l.projetado && (
                        <Badge tone="amber" className="ml-2" title={l.fonteProjecao || ''}>projetado</Badge>
                      )}
                    </td>
                    <td className="p-2">{l.vencimento}</td>
                    <td className="p-2">{brl(l.valorDevidoOriginal)}</td>
                    <td className="p-2" title={l.correcao.criterio}>{brl(l.correcao.valor)}</td>
                    <td className="p-2" title={l.juros.criterio}>{brl(l.juros.valor)}</td>
                    <td className="p-2">{brl(l.pagamentosAbatidos.reduce((s, p) => s + p.valorPago, 0))}</td>
                    <td className="p-2">{brl(l.saldoAtualizado)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-300 font-medium">
                  <td className="p-2" colSpan="2">TOTAIS</td>
                  <td className="p-2">{brl(memoria.totais.somaOriginal)}</td>
                  <td className="p-2">{brl(memoria.totais.somaCorrecao)}</td>
                  <td className="p-2">{brl(memoria.totais.somaJuros)}</td>
                  <td className="p-2">{brl(memoria.totais.somaPagamentos)}</td>
                  <td className="p-2">{brl(memoria.totais.saldo)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {temDoisTotais && (
            <div className="mt-2 grid gap-1 text-sm">
              <p>Saldo até o último índice firme: <strong>{brl(memoria.totais.saldoAteUltimoIndiceFirme)}</strong></p>
              <p>Saldo com projeção: <strong>{brl(memoria.totais.saldoComProjecao)}</strong></p>
            </div>
          )}

          {projecao && (
            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="nota-projecao">
                Nota sobre a correção projetada (admissibilidade)
              </label>
              <textarea
                id="nota-projecao"
                rows={6}
                className="w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-900"
                value={nota || NOTA_PROJECAO_PADRAO}
                onChange={(e) => setNota(e.target.value)}
                onBlur={(e) => salvarNota(e.target.value)}
              />
            </div>
          )}

          <div className="mt-4">
            <h3 className="font-medium text-slate-900">Fundamentos</h3>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {fundamentos.map((f) => <Badge key={f}>{f}</Badge>)}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
