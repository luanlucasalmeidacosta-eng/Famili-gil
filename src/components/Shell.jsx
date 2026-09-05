import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { Button } from './ui.jsx'

export default function Shell({ children }) {
  const { session, sair } = useAuth()
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link to="/casos" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">F</span>
            <span className="text-sm font-semibold text-slate-900">FamiliÁgil</span>
          </Link>
          {session && (
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <span className="hidden sm:inline">{session.user?.email}</span>
              <Button variant="ghost" size="sm" onClick={sair}>Sair</Button>
            </div>
          )}
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
