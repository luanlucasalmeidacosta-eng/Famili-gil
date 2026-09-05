import { useCallback, useEffect, useState } from 'react'
import { apiFetch, apiFetchBlob } from '../../lib/api.js'
import { supabase } from '../../lib/supabase.js'

const brl = (n) => `R$ ${Number(n).toFixed(2).replace('.', ',')}`

const ROTULOS_INTERVALO = {
  antes_casamento: 'Antes do casamento',
  constancia: 'Constância do casamento/união',
  apos_fim_constancia: 'Após o fim da constância',
}

const fmtData = (d) => (d ? d : '—')

export default function AbaMemoria({ caso }) {
  const [memoria, setMemoria] = useState(null)
  const [comparada, setComparada] = useState(null)
  const [versoes, setVersoes] = useState([])
  const [versaoB, setVersaoB] = useState('')
  const [erro, setErro] = useState('')

  const listarVersoes = useCallback(async () => {
    const { data } = await supabase.from('partilha_memoria').select('versao, cenario_id').eq('caso_id', caso.id).order('versao', { ascending: false })
    setVersoes(data || [])
  }, [caso.id])
  useEffect(() => { listarVersoes() }, [listarVersoes])

  const carregarVersao = useCallback(async (versao) => {
    setErro('')
    try {
      const m = await apiFetch(`/api/partilha/memoria?casoId=${caso.id}${versao ? `&versao=${versao}` : ''}`)
      setMemoria(m)
    } catch (e) { setErro(e.message) }
  }, [caso.id])
  useEffect(() => { carregarVersao() }, [carregarVersao])

  async function comparar() {
    if (!memoria || !versaoB) return
    setErro('')
    try {
      const [m1, m2] = await apiFetch(`/api/partilha/memoria?casoId=${caso.id}&comparar=${memoria.versao},${versaoB}`)
      setComparada(m2.versao === Number(versaoB) ? m2 : m1)
    } catch (e) { setErro(e.message) }
  }

  async function exportar(formato) {
    if (!memoria) return
    try {
      const { blob, filename } = await apiFetchBlob(`/api/partilha/exportar?casoId=${caso.id}&versao=${memoria.versao}&formato=${formato}`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
    } catch (e) { setErro(e.message) }
  }

  return (
    <div className="text-sm">
      <div className="mb-3 flex flex-wrap items-end gap-3">
        {versoes.length > 0 && (
          <label>Versão
            <select onChange={(e) => carregarVersao(e.target.value)} className="mt-1 block rounded border px-2 py-1">
              {versoes.map((v) => <option key={v.versao} value={v.versao}>v{v.versao}</option>)}
            </select>
          </label>
        )}
        {versoes.length > 1 && (
          <>
            <label>Comparar com
              <select value={versaoB} onChange={(e) => setVersaoB(e.target.value)} className="mt-1 block rounded border px-2 py-1">
                <option value="">— nenhuma —</option>
                {versoes.map((v) => <option key={v.versao} value={v.versao}>v{v.versao}</option>)}
              </select>
            </label>
            <button onClick={comparar} disabled={!versaoB} className="rounded border px-3 py-1.5 disabled:opacity-50">Comparar</button>
          </>
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
              <th className="p-2">Descrição</th><th className="p-2">Valor</th><th className="p-2">Classificação</th>
              <th className="p-2">Fundamento</th><th className="p-2">Alocado</th>
            </tr></thead>
            <tbody>
              {memoria.linhas_bens.map((l) => (
                <tr key={l.bemId} className="border-t">
                  <td className="p-2">{l.descricao}</td>
                  <td className="p-2">{brl(l.valorLiquido)}</td>
                  <td className="p-2">{l.classificacao}</td>
                  <td className="p-2 text-xs">{l.citacao}</td>
                  <td className="p-2">{l.alocadoPara || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded border p-3">
              <h3 className="font-medium">Quinhões e tornas — v{memoria.versao}</h3>
              <p>Parte A: acervo {brl(memoria.quadro_quinhoes.parteA.acervoLiquido)} — torna {brl(memoria.quadro_quinhoes.parteA.torna)}</p>
              <p>Parte B: acervo {brl(memoria.quadro_quinhoes.parteB.acervoLiquido)} — torna {brl(memoria.quadro_quinhoes.parteB.torna)}</p>
            </div>
            {comparada && (
              <div className="rounded border p-3">
                <h3 className="font-medium">Quinhões e tornas — v{comparada.versao}</h3>
                <p>Parte A: acervo {brl(comparada.quadro_quinhoes.parteA.acervoLiquido)} — torna {brl(comparada.quadro_quinhoes.parteA.torna)}</p>
                <p>Parte B: acervo {brl(comparada.quadro_quinhoes.parteB.acervoLiquido)} — torna {brl(comparada.quadro_quinhoes.parteB.torna)}</p>
              </div>
            )}
          </div>

          {memoria.linha_tempo?.length > 0 && (
            <div className="mt-4 rounded border p-3">
              <h3 className="font-medium">Linha do tempo</h3>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {memoria.linha_tempo.map((item) => (
                  <div key={item.intervalo} className="rounded border p-2">
                    <p className="font-medium">{ROTULOS_INTERVALO[item.intervalo] || item.intervalo}</p>
                    <p className="text-xs text-neutral-600">{fmtData(item.de)} – {fmtData(item.ate)}</p>
                    {item.alertas?.length > 0 && (
                      <ul className="mt-1 text-xs text-amber-700">
                        {item.alertas.map((a, i) => <li key={i}>• {a}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {memoria.alertas_tributarios?.length > 0 && (
            <div className="mt-4 rounded border p-3">
              <h3 className="font-medium">Enquadramento tributário</h3>
              {memoria.alertas_tributarios.map((t, i) => (
                <p key={i}>{t.tipo} sobre {brl(t.base)} — {t.fundamento}</p>
              ))}
              <p className="text-xs italic text-neutral-500">O valor do imposto não é calculado aqui.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
