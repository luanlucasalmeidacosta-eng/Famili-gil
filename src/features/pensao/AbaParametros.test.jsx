import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AbaParametros from './AbaParametros.jsx'

const upsert = vi.fn(async () => ({ error: null }))
vi.mock('../../lib/supabase.js', () => ({
  supabase: { from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    upsert: (row, opts) => { upsert(row, opts); return Promise.resolve({ error: null }) },
  }) },
}))

describe('AbaParametros', () => {
  it('salva os parâmetros com o caso_id', async () => {
    render(<AbaParametros caso={{ id: 'c1' }} />)
    await userEvent.type(screen.getByLabelText('valor'), '1200')
    await userEvent.type(screen.getByLabelText(/dia do vencimento/i), '5')
    await userEvent.type(screen.getByLabelText(/data inicial/i), '2024-01-01')
    await userEvent.type(screen.getByLabelText(/data final/i), '2024-12-31')
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }))
    await waitFor(() => expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ caso_id: 'c1', valor_base: 1200, dia_vencimento: 5 }),
      expect.objectContaining({ onConflict: 'caso_id' }),
    ))
  })
})
