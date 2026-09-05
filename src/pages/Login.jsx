import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider.jsx'
import { Button, Field, Input, Alert } from '../components/ui.jsx'

export default function Login() {
  const { entrar } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    try {
      await entrar(email, senha)
    } catch (err) {
      setErro(err.message || 'não foi possível entrar')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">F</span>
          <h1 className="text-lg font-semibold text-slate-900">FamiliÁgil</h1>
          <p className="mt-1 text-sm text-slate-500">Entre para acessar seus casos</p>
        </div>
        <Field label="E-mail">
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Senha">
          <Input type="password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
        </Field>
        {erro && <Alert>{erro}</Alert>}
        <Button type="submit" disabled={enviando} className="w-full" size="lg">
          {enviando ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </div>
  )
}
