import { useState } from 'react'
import AbaRegimeMarcos from '../features/partilha/AbaRegimeMarcos.jsx'
import AbaBens from '../features/partilha/AbaBens.jsx'
import AbaPassivos from '../features/partilha/AbaPassivos.jsx'
import AbaCenarios from '../features/partilha/AbaCenarios.jsx'
import AbaDocumentos from '../features/AbaDocumentos.jsx'
import AbaMemoria from '../features/partilha/AbaMemoria.jsx'

const ABAS = [
  ['regime', 'Regime e marcos', AbaRegimeMarcos],
  ['bens', 'Bens', AbaBens],
  ['passivos', 'Passivos', AbaPassivos],
  ['cenarios', 'Cenários', AbaCenarios],
  ['documentos', 'Documentos', AbaDocumentos],
  ['memoria', 'Memória de partilha', AbaMemoria],
]

export default function CasoPartilha({ caso }) {
  const [aba, setAba] = useState('regime')
  const Ativa = ABAS.find(([k]) => k === aba)[2]
  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-lg font-semibold">{caso?.titulo} — Partilha de Bens</h1>
      <nav className="mt-4 flex gap-1 border-b text-sm">
        {ABAS.map(([k, rotulo]) => (
          <button
            key={k} onClick={() => setAba(k)}
            className={`px-3 py-2 ${aba === k ? 'border-b-2 border-neutral-900 font-medium' : 'text-neutral-500'}`}
          >
            {rotulo}
          </button>
        ))}
      </nav>
      <div className="mt-4">
        <Ativa caso={caso} />
      </div>
    </div>
  )
}
