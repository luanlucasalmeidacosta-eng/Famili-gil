import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { PageHeader } from '../components/ui.jsx'
import ListaAliquotas from '../features/biblioteca/ListaAliquotas.jsx'

const TIPO_POR_SLUG = { aliquota_itbi: 'itbi', aliquota_itcmd: 'itcmd' }

export default function Biblioteca() {
  const [categorias, setCategorias] = useState([])

  useEffect(() => {
    supabase.from('biblioteca_categorias').select('*').order('ordem')
      .then(({ data }) => setCategorias(data || []))
  }, [])

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <PageHeader
        eyebrow="Itens reaproveitáveis"
        title="Biblioteca"
      />
      <p className="mb-6 text-sm text-slate-500">
        Dados fixos que alimentam os cálculos e se reaproveitam entre casos. Editar aqui não
        altera cálculos já salvos.
      </p>
      {categorias.map((cat) => (
        <section key={cat.slug} className="mb-8">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">{cat.rotulo}</h2>
          {TIPO_POR_SLUG[cat.slug]
            ? <ListaAliquotas tipo={TIPO_POR_SLUG[cat.slug]} />
            : <p className="text-sm text-slate-400">Categoria ainda não disponível.</p>}
        </section>
      ))}
    </div>
  )
}
