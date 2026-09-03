import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider.jsx'

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
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-xl border bg-white p-6">
        <h1 className="text-lg font-semibold">FamiliÁgil</h1>
        <label className="block text-sm">
          E-mail
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Senha
          <input
            type="password" required value={senha} onChange={(e) => setSenha(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>
        {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}
        <button
          type="submit" disabled={enviando}
          className="w-full rounded bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
