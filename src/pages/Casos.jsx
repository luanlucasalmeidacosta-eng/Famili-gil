import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { apiFetch } from '../lib/api.js'
import { Button, Card, Badge, Field, Input, Alert, PageHeader, EmptyState } from '../components/ui.jsx'

const ROTULO_TIPO = { pensao: 'Pensão', partilha: 'Partilha' }

export default function Casos() {
  const navigate = useNavigate()
  const [casos, setCasos] = useState([])
  const [verArquivados, setVerArquivados] = useState(false)
  const [abrindo, setAbrindo] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [tipo, setTipo] = useState('pensao')
  const [erro, setErro] = useState('')
  const [excluindo, setExcluindo] = useState(null)
  const [tituloDigitado, setTituloDigitado] = useState('')
  const [erroExcluir, setErroExcluir] = useState('')

  async function carregar(mostrarArquivados) {
    const { data, error } = await supabase
      .from('casos').select('*').eq('arquivado', mostrarArquivados).order('criado_em', { ascending: false })
    if (!error) setCasos(data ?? [])
  }
  useEffect(() => { carregar(verArquivados) }, [verArquivados])

  async function criar(e) {
    e.preventDefault()
    setErro('')
    const { data, error } = await supabase
      .from('casos').insert({ titulo, tipo, parte_a: '', parte_b: '' }).select()
    if (error) { setErro(error.message); return }
    navigate(`/caso/${data[0].id}`)
  }

  async function arquivar(id) {
    await supabase.from('casos').update({ arquivado: true }).eq('id', id)
    carregar(verArquivados)
  }

  async function desarquivar(id) {
    await supabase.from('casos').update({ arquivado: false }).eq('id', id)
    carregar(verArquivados)
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <PageHeader
        title="Casos"
        actions={!verArquivados && <Button onClick={() => setAbrindo(true)}>+ Novo caso</Button>}
      />

      <div className="mb-3 flex gap-1 border-b border-slate-200 text-sm">
        <button
          onClick={() => setVerArquivados(false)}
          className={`px-3 py-2 ${!verArquivados ? 'border-b-2 border-indigo-600 font-medium text-slate-900' : 'text-slate-500'}`}
        >
          Ativos
        </button>
        <button
          onClick={() => setVerArquivados(true)}
          className={`px-3 py-2 ${verArquivados ? 'border-b-2 border-indigo-600 font-medium text-slate-900' : 'text-slate-500'}`}
        >
          Arquivados
        </button>
      </div>

      <Card className="divide-y divide-slate-100">
        {casos.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <button className="min-w-0 flex-1 text-left" onClick={() => navigate(`/caso/${c.id}`)}>
              <span className="block truncate text-sm font-medium text-slate-900">{c.titulo}</span>
              <Badge tone="indigo" className="mt-1">{ROTULO_TIPO[c.tipo] || c.tipo}</Badge>
            </button>
            {verArquivados ? (
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => desarquivar(c.id)}>Desarquivar</Button>
                <Button variant="danger" size="sm" onClick={() => { setExcluindo(c); setTituloDigitado(''); setErroExcluir('') }}>
                  Excluir definitivamente
                </Button>
              </div>
            ) : (
              <Button variant="danger" size="sm" onClick={() => arquivar(c.id)}>Arquivar</Button>
            )}
          </div>
        ))}
        {casos.length === 0 && (
          <div className="p-2">
            <EmptyState>
              {verArquivados ? 'Nenhum caso arquivado.' : 'Nenhum caso ativo ainda — crie o primeiro.'}
            </EmptyState>
          </div>
        )}
      </Card>

      {abrindo && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-900/40 px-4">
          <form onSubmit={criar} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-lg">
            <h2 className="font-semibold text-slate-900">Novo caso</h2>
            <Field label="Título">
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
            </Field>
            <fieldset className="text-sm">
              <legend className="mb-1 font-medium text-slate-700">Tipo</legend>
              <label className="mr-4">
                <input type="radio" name="tipo" value="pensao"
                  checked={tipo === 'pensao'} onChange={() => setTipo('pensao')} /> Pensão
              </label>
              <label>
                <input type="radio" name="tipo" value="partilha"
                  checked={tipo === 'partilha'} onChange={() => setTipo('partilha')} /> Partilha
              </label>
            </fieldset>
            {erro && <Alert>{erro}</Alert>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setAbrindo(false)}>Cancelar</Button>
              <Button type="submit">Criar</Button>
            </div>
          </form>
        </div>
      )}

      {excluindo && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-lg text-sm">
            <h2 className="font-semibold text-slate-900">Excluir definitivamente</h2>
            <p className="text-slate-600">
              Isto apaga o caso <strong>{excluindo.titulo}</strong> e tudo ligado a ele — parâmetros,
              parcelas, pagamentos, bens, passivos, cenários, memórias de cálculo e anexos. Não há como desfazer.
            </p>
            <Field label={`Digite o título do caso para confirmar: "${excluindo.titulo}"`}>
              <Input value={tituloDigitado} onChange={(e) => setTituloDigitado(e.target.value)} />
            </Field>
            {erroExcluir && <Alert>{erroExcluir}</Alert>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setExcluindo(null)}>Cancelar</Button>
              <Button
                variant="danger"
                disabled={tituloDigitado !== excluindo.titulo}
                onClick={async () => {
                  setErroExcluir('')
                  try {
                    await apiFetch('/api/casos/excluir', {
                      method: 'POST',
                      body: { casoId: excluindo.id, tituloConfirmacao: tituloDigitado },
                    })
                    setExcluindo(null)
                    carregar(verArquivados)
                  } catch (err) { setErroExcluir(err.message) }
                }}
              >
                Confirmar exclusão
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
