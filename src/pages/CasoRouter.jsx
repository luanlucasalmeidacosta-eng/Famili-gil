import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import CasoPensao from './CasoPensao.jsx'
import CasoPartilha from './CasoPartilha.jsx'

export default function CasoRouter() {
  const { id } = useParams()
  const [caso, setCaso] = useState(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    supabase.from('casos').select('*').eq('id', id).single().then(({ data, error }) => {
      if (error) setErro(error.message)
      else setCaso(data)
    })
  }, [id])

  if (erro) return <p role="alert" className="p-6 text-sm text-red-600">{erro}</p>
  if (!caso) return <p className="p-6 text-sm text-neutral-500">Carregando…</p>
  return caso.tipo === 'partilha' ? <CasoPartilha caso={caso} /> : <CasoPensao caso={caso} />
}
