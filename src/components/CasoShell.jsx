import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from './ui.jsx'

export default function CasoShell({ caso, subtitulo, abas, abaInicial }) {
  const [aba, setAba] = useState(abaInicial)
  const Ativa = abas.find(([k]) => k === aba)[2]
  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <Link to="/casos" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600">
        ← Todos os casos
      </Link>
      <PageHeader eyebrow={subtitulo} title={caso?.titulo} />
      <nav className="flex flex-wrap gap-1 border-b border-slate-200 text-sm">
        {abas.map(([k, rotulo]) => (
          <button
            key={k} onClick={() => setAba(k)}
            className={`rounded-t-lg px-3 py-2 transition-colors ${
              aba === k
                ? 'border-b-2 border-indigo-600 font-medium text-slate-900'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {rotulo}
          </button>
        ))}
      </nav>
      <div className="mt-5">
        <Ativa caso={caso} />
      </div>
    </div>
  )
}
