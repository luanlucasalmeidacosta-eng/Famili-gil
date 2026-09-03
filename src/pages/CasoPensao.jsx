import { useState } from 'react'
import AbaParametros from '../features/pensao/AbaParametros.jsx'
import AbaParcelas from '../features/pensao/AbaParcelas.jsx'
import AbaPagamentos from '../features/pensao/AbaPagamentos.jsx'
import AbaDocumentos from '../features/pensao/AbaDocumentos.jsx'
import AbaMemoria from '../features/pensao/AbaMemoria.jsx'

const ABAS = [
  ['parametros', 'Parâmetros', AbaParametros],
  ['parcelas', 'Parcelas', AbaParcelas],
  ['pagamentos', 'Pagamentos', AbaPagamentos],
  ['documentos', 'Documentos', AbaDocumentos],
  ['memoria', 'Memória de cálculo', AbaMemoria],
]

export default function CasoPensao({ caso }) {
  const [aba, setAba] = useState('parametros')
  const Ativa = ABAS.find(([k]) => k === aba)[2]
  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-lg font-semibold">{caso?.titulo} — Pensão Alimentícia</h1>
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
