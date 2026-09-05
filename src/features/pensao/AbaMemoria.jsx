import { useCallback, useEffect, useState } from 'react'
import { apiFetch, apiFetchBlob } from '../../lib/api.js'
import { supabase } from '../../lib/supabase.js'
import { Button, Field, Input, Alert, Badge, EmptyState } from '../../components/ui.jsx'

const brl = (n) => `R$ ${Number(n).toFixed(2).replace('.', ',')}`

export default function AbaMemoria({ caso }) {
  const [dataBase, setDataBase] = useState('')
  const [memoria, setMemoria] = useState(null)
  const [versoes, setVersoes] = useState([])
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  const listarVersoes = useCallback(async () => {
    const { data } = await supabase.from('pensao_memoria').select('versao').eq('caso_id', caso.id).order('versao', { ascending: false })
    setVersoes((data || []).map((r) => r.versao))
  }, [caso.id])
  useEffect(() => { listarVersoes() }, [listarVersoes])

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
      await apiFetch('/api/pensao/calcular', { method: 'POST', body: { casoId: caso.id, dataBase } })
      await listarVersoes()
      await carregarVersao()
    } catch (e) { setErro(e.message) } finally { setCarregando(false) }
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

  return (
    <div className="text-sm">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Data-base">
          <Input type="date" value={dataBase} onChange={(e) => setDataBase(e.target.value)} />
        </Field>
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
                  <tr key={l.parcelaId} className="border-t border-slate-100">
                    <td className="p-2">{l.competencia}</td>
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
