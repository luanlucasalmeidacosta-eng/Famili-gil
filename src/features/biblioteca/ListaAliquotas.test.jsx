import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const insert = vi.fn(async () => ({ error: null }))
const del = vi.fn(async () => ({ error: null }))
const linhas = [
  { id: 'a1', tipo: 'itbi', uf: 'SP', municipio: 'São Paulo', aliquota: 3, faixas: [], norma: 'Lei Municipal nº 11.154/1991' },
]
vi.mock('../../lib/supabase.js', () => ({
  supabase: { from: () => ({
    select: () => ({ eq: () => ({ order: async () => ({ data: linhas, error: null }) }) }),
    insert: (row) => { insert(row); return Promise.resolve({ error: null }) },
    update: () => ({ eq: async () => ({ error: null }) }),
    delete: () => ({ eq: async () => { del(); return { error: null } } }),
  }) },
}))

beforeEach(() => {
  insert.mockClear()
  del.mockClear()
})

describe('ListaAliquotas (itbi)', () => {
  it('lista as entradas do usuário', async () => {
    const { default: ListaAliquotas } = await import('./ListaAliquotas.jsx')
    render(<ListaAliquotas tipo="itbi" />)
    await waitFor(() => expect(screen.getByText(/São Paulo/)).toBeInTheDocument())
    expect(screen.getByText(/3\s*%/)).toBeInTheDocument()
  })

  it('adiciona uma alíquota de ITBI', async () => {
    const { default: ListaAliquotas } = await import('./ListaAliquotas.jsx')
    render(<ListaAliquotas tipo="itbi" />)
    await userEvent.click(screen.getByRole('button', { name: /adicionar/i }))
    await userEvent.type(screen.getByLabelText(/uf/i), 'RJ')
    await userEvent.type(screen.getByLabelText(/munic[íi]pio/i), 'Niterói')
    await userEvent.type(screen.getByLabelText(/al[íi]quota/i), '2')
    await userEvent.type(screen.getByLabelText(/norma/i), 'Lei Municipal nº 2.597/2008')
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }))
    await waitFor(() => expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'itbi', uf: 'RJ', municipio: 'Niterói', aliquota: 2 }),
    ))
  })
})

describe('ListaAliquotas (itcmd) — validação de faixas', () => {
  it('rejeita faixas sem faixa aberta e não chama insert', async () => {
    const { default: ListaAliquotas } = await import('./ListaAliquotas.jsx')
    render(<ListaAliquotas tipo="itcmd" />)
    await userEvent.click(screen.getByRole('button', { name: /adicionar/i }))
    await userEvent.type(screen.getByLabelText(/uf/i), 'MG')
    await userEvent.type(screen.getByLabelText(/norma/i), 'Lei Estadual nº 14.941/2003')
    // uma única faixa com teto (sem faixa aberta) → inválido
    await userEvent.type(screen.getByLabelText(/teto da faixa 1/i), '100000')
    await userEvent.type(screen.getByLabelText(/al[íi]quota da faixa 1/i), '5')
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/última faixa deve ser aberta/i)
    expect(insert).not.toHaveBeenCalled()
  })
})
