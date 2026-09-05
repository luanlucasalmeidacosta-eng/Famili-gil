import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AbaPassivos from './AbaPassivos.jsx'

const insert = vi.fn(async () => ({ error: null }))
vi.mock('../../lib/supabase.js', () => ({
  supabase: { from: (t) => ({
    select: () => ({ eq: () => ({ order: async () => ({ data: t === 'partilha_bens' ? [{ id: 'b1', descricao: 'Casa' }] : [], error: null }) }) }),
    insert: (row) => { insert(t, row); return Promise.resolve({ error: null }) },
    delete: () => ({ eq: async () => ({ error: null }) }),
  }) },
}))

describe('AbaPassivos', () => {
  it('cadastra um passivo', async () => {
    render(<AbaPassivos caso={{ id: 'c1' }} />)
    await userEvent.type(screen.getByLabelText(/descrição/i), 'Financiamento do carro')
    await userEvent.type(screen.getByLabelText(/valor/i), '30000')
    await userEvent.click(screen.getByRole('button', { name: /adicionar passivo/i }))
    await waitFor(() => expect(insert).toHaveBeenCalledWith('partilha_passivos',
      expect.objectContaining({ caso_id: 'c1', descricao: 'Financiamento do carro', valor: 30000 })))
  })
})
