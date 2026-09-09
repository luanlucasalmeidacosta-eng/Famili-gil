import { useCallback, useEffect, useState } from 'react'
import { apiFetch, apiFetchBlob } from '../../lib/api.js'
import { supabase } from '../../lib/supabase.js'
import { Button, Select, Alert, Card, EmptyState } from '../../components/ui.jsx'

const brl = (n) => `R$ ${Number(n).toFixed(2).replace('.', ',')}`

const ROTULOS_INTERVALO = {
  antes_casamento: 'Antes do casamento',
  constancia: 'Constância do casamento/união',
  apos_fim_constancia: 'Após o fim da constância',
}

const fmtData = (d) => (d ? d : '—')
const pct = (p) => (p == null ? '—' : `${p}%`)
const valor = (v) => (v == null ? '—' : brl(v))

function QuadroQuinhoes({ titulo, quadro }) {
  return (
    <Card className="p-3">
      <h3 className="font-medium text-slate-900">{titulo}</h3>
      <table className="mt-2 w-full text-left">
        <thead><tr className="text-xs text-slate-500">
          <th className="py-1">Parte</th><th className="py-1">Acervo/aquestos</th>
          <th className="py-1">Quinhão ideal</th><th className="py-1">Valor alocado</th><th className="py-1">Torna</th>
        </tr></thead>
        <tbody>
          {[['Parte A', quadro.parteA], ['Parte B', quadro.parteB]].map(([nome, p]) => (
            <tr key={nome} className="border-t border-slate-100">
              <td className="py-1">{nome}</td>
              <td className="py-1">{brl(p.acervoLiquido)}</td>
              <td className="py-1">{pct(p.quinhaoIdealPct)} — {valor(p.quinhaoIdealValor)}</td>
              <td className="py-1">{valor(p.valorAlocado)}</td>
              <td className="py-1">{brl(p.torna)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

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

  const versaoMaisRecente = versoes[0]?.versao

  return (
    <div className="text-sm">
      {versoes.length > 0 && (
        <div className="mb-4">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">Versões calculadas</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {versoes.map((v) => (
              <button
                key={v.versao}
                onClick={() => carregarVersao(v.versao)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  memoria?.versao === v.versao
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                v{v.versao}{v.versao === versaoMaisRecente ? ' · atual' : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        {versoes.length > 1 && (
          <>
            <label className="text-sm text-slate-700">Comparar com
              <Select value={versaoB} onChange={(e) => setVersaoB(e.target.value)} className="mt-1 w-32">
                <option value="">— nenhuma —</option>
                {versoes.map((v) => <option key={v.versao} value={v.versao}>v{v.versao}</option>)}
              </Select>
            </label>
            <Button variant="secondary" onClick={comparar} disabled={!versaoB}>Comparar</Button>
          </>
        )}
        {memoria && (
          <span className="flex gap-2">
            <Button variant="secondary" onClick={() => exportar('docx')}>Exportar Word</Button>
            <Button variant="secondary" onClick={() => exportar('xlsx')}>Exportar planilha</Button>
          </span>
        )}
      </div>

      {erro && <Alert>{erro}</Alert>}

      {!memoria && versoes.length === 0 && !erro && (
        <EmptyState>Nenhuma versão calculada ainda — cadastre um cenário e clique em Calcular.</EmptyState>
      )}

      {memoria && (
        <>
          {memoria.alertas?.length > 0 && (
            <div className="mb-3">
              <Alert tone="amber"><ul>{memoria.alertas.map((a, i) => <li key={i}>• {a}</li>)}</ul></Alert>
            </div>
          )}
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left">
              <thead><tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="p-2">Descrição</th><th className="p-2">Valor</th><th className="p-2">Classificação</th>
                <th className="p-2">Fundamento</th><th className="p-2">Alocado</th>
              </tr></thead>
              <tbody>
                {memoria.linhas_bens.map((l) => (
                  <tr key={l.bemId} className="border-t border-slate-100">
                    <td className="p-2">{l.descricao}</td>
                    <td className="p-2">{brl(l.valorLiquido)}</td>
                    <td className="p-2">{l.classificacao}</td>
                    <td className="p-2 text-xs">{l.citacao}</td>
                    <td className="p-2">{l.alocadoPara || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <QuadroQuinhoes titulo={`Quinhões e tornas — v${memoria.versao}`} quadro={memoria.quadro_quinhoes} />
            {comparada && (
              <QuadroQuinhoes titulo={`Quinhões e tornas — v${comparada.versao}`} quadro={comparada.quadro_quinhoes} />
            )}
          </div>

          {memoria.linha_tempo?.length > 0 && (
            <Card className="mt-4 p-3">
              <h3 className="font-medium text-slate-900">Linha do tempo</h3>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {memoria.linha_tempo.map((item) => (
                  <div key={item.intervalo} className="rounded-lg border border-slate-200 p-2">
                    <p className="font-medium text-slate-900">{ROTULOS_INTERVALO[item.intervalo] || item.intervalo}</p>
                    <p className="text-xs text-slate-500">{fmtData(item.de)} – {fmtData(item.ate)}</p>
                    {item.alertas?.length > 0 && (
                      <ul className="mt-1 text-xs text-amber-700">
                        {item.alertas.map((a, i) => <li key={i}>• {a}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {memoria.alertas_tributarios?.length > 0 && (
            <Card className="mt-4 p-3">
              <h3 className="font-medium text-slate-900">Enquadramento tributário</h3>
              {memoria.alertas_tributarios.map((t, i) => (
                <p key={i}>
                  {t.tipo} sobre {brl(t.base)}
                  {t.valorImposto != null && (
                    <> — imposto {brl(t.valorImpostoManual ?? t.valorImposto)}
                      {t.valorImpostoManual != null && ' (valor informado pelo advogado)'}
                      {t.aliquota != null && ` · alíquota ${t.aliquota}%`}
                      {t.aliquotaNorma && ` · ${t.aliquotaNorma}`}
                    </>
                  )}
                </p>
              ))}
              <p className="mt-1 text-xs italic text-slate-500">
                {memoria.alertas_tributarios.some((t) => t.valorImposto != null)
                  ? 'Valor calculado com a alíquota informada; confira a vigência da norma.'
                  : 'O valor do imposto não é calculado aqui — informe a alíquota no cenário.'}
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
