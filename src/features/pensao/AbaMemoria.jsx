import { useCallback, useEffect, useState } from 'react'
import { apiFetch, apiFetchBlob } from '../../lib/api.js'
import { supabase } from '../../lib/supabase.js'

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

  return (
    <div className="text-sm">
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label>Data-base
          <input type="date" value={dataBase} onChange={(e) => setDataBase(e.target.value)} className="mt-1 block rounded border px-2 py-1" />
        </label>
        <button onClick={calcular} disabled={!dataBase || carregando} className="rounded bg-neutral-900 px-3 py-1.5 text-white disabled:opacity-50">
          {carregando ? 'Calculando…' : 'Calcular'}
        </button>
        {versoes.length > 0 && (
          <label>Versão
            <select onChange={(e) => carregarVersao(e.target.value)} className="mt-1 block rounded border px-2 py-1">
              {versoes.map((v) => <option key={v} value={v}>v{v}</option>)}
            </select>
          </label>
        )}
        {memoria && (
          <span className="flex gap-2">
            <button onClick={() => exportar('docx')} className="rounded border px-3 py-1.5">Exportar Word</button>
            <button onClick={() => exportar('xlsx')} className="rounded border px-3 py-1.5">Exportar planilha</button>
          </span>
        )}
      </div>

      {erro && <p role="alert" className="mb-3 rounded border border-red-300 bg-red-50 p-2 text-red-700">{erro}</p>}

      {memoria && (
        <>
          {memoria.alertas?.length > 0 && (
            <ul role="alert" className="mb-3 rounded border border-amber-300 bg-amber-50 p-2">
              {memoria.alertas.map((a, i) => <li key={i}>• {a}</li>)}
            </ul>
          )}
          <table className="w-full border">
            <thead><tr className="bg-neutral-50 text-left">
              <th className="p-2">Competência</th><th className="p-2">Vencimento</th><th className="p-2">Valor original</th>
              <th className="p-2">Correção</th><th className="p-2">Juros</th><th className="p-2">Pagamentos</th><th className="p-2">Saldo</th>
            </tr></thead>
            <tbody>
              {memoria.linhas.map((l) => (
                <tr key={l.parcelaId} className="border-t">
                  <td className="p-2">{l.competencia}</td>
                  <td className="p-2">{l.vencimento}</td>
                  <td className="p-2">{brl(l.valorDevidoOriginal)}</td>
                  <td className="p-2" title={l.correcao.criterio}>{brl(l.correcao.valor)}</td>
                  <td className="p-2" title={l.juros.criterio}>{brl(l.juros.valor)}</td>
                  <td className="p-2">{brl(l.pagamentosAbatidos.reduce((s, p) => s + p.valorPago, 0))}</td>
                  <td className="p-2">{brl(l.saldoAtualizado)}</td>
                </tr>
              ))}
              <tr className="border-t-2 font-medium">
                <td className="p-2" colSpan="2">TOTAIS</td>
                <td className="p-2">{brl(memoria.totais.somaOriginal)}</td>
                <td className="p-2">{brl(memoria.totais.somaCorrecao)}</td>
                <td className="p-2">{brl(memoria.totais.somaJuros)}</td>
                <td className="p-2">{brl(memoria.totais.somaPagamentos)}</td>
                <td className="p-2">{brl(memoria.totais.saldo)}</td>
              </tr>
            </tbody>
          </table>
          <div className="mt-3">
            <h3 className="font-medium">Fundamentos</h3>
            <ul className="list-inside list-disc text-neutral-700">
              {fundamentos.map((f) => <li key={f}>{f}</li>)}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
