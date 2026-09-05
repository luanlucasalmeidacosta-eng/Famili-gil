import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AbaRegimeMarcos from './AbaRegimeMarcos.jsx'

const upsert = vi.fn(async () => ({ error: null }))
vi.mock('../../lib/supabase.js', () => ({
  supabase: { from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    upsert: (row, opts) => { upsert(row, opts); return Promise.resolve({ error: null }) },
  }) },
}))

describe('AbaRegimeMarcos', () => {
  it('salva o regime e as datas com o caso_id', async () => {
    render(<AbaRegimeMarcos caso={{ id: 'c1' }} />)
    await userEvent.type(screen.getByLabelText(/casamento/i), '2015-01-01')
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }))
    await waitFor(() => expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ caso_id: 'c1', regime_bens: 'comunhao_parcial', data_casamento: '2015-01-01' }),
      expect.objectContaining({ onConflict: 'caso_id' }),
    ))
  })

  it('mostra o seletor de efeito da separação de fato só quando a data é preenchida', async () => {
    render(<AbaRegimeMarcos caso={{ id: 'c1' }} />)
    expect(screen.queryByLabelText(/efeito da separação de fato/i)).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText(/separação de fato/i), '2022-06-01')
    expect(screen.getByLabelText(/efeito da separação de fato/i)).toBeInTheDocument()
  })
})
