import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AbaPagamentos from './AbaPagamentos.jsx'

const insert = vi.fn(async () => ({ error: null }))
vi.mock('../../lib/supabase.js', () => ({
  supabase: { from: (t) => ({
    select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }),
    insert: (row) => { insert(t, row); return Promise.resolve({ error: null }) },
    delete: () => ({ eq: async () => ({ error: null }) }),
  }) },
}))

describe('AbaPagamentos', () => {
  it('lança um pagamento com data e valor', async () => {
    render(<AbaPagamentos caso={{ id: 'c1' }} />)
    await userEvent.type(screen.getByLabelText(/data do pagamento/i), '2024-03-05')
    await userEvent.type(screen.getByLabelText(/valor/i), '750')
    await userEvent.click(screen.getByRole('button', { name: /lançar/i }))
    await waitFor(() => expect(insert).toHaveBeenCalledWith('pensao_pagamentos',
      expect.objectContaining({ caso_id: 'c1', data_pagamento: '2024-03-05', valor: 750 })))
  })
})
