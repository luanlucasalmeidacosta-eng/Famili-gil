import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AbaParcelas from './AbaParcelas.jsx'

const parcelas = [
  { id: 'p1', competencia: '2024-01-01', vencimento: '2024-01-10', valor_devido: 1000, origem: 'gerada', ativa: true, observacao: null },
]
const update = vi.fn(async () => ({ error: null }))
vi.mock('../../lib/supabase.js', () => ({
  supabase: { from: (t) => ({
    select: () => ({ eq: () => ({ order: async () => ({ data: parcelas, error: null }), maybeSingle: async () => ({ data: { caso_id: 'c1', tipo_valor: 'fixo', valor_base: 1000, dia_vencimento: 10, data_inicial: '2024-01-01', data_final: '2024-02-29' }, error: null }) }) }),
    update: (patch) => ({ eq: async () => { update(t, patch); return { error: null } } }),
    upsert: async () => ({ error: null }),
    insert: async () => ({ error: null }),
    delete: () => ({ eq: async () => ({ error: null }) }),
  }) },
}))

describe('AbaParcelas', () => {
  it('lista a parcela e persiste a inativação ao desmarcar "ativa"', async () => {
    render(<AbaParcelas caso={{ id: 'c1' }} />)
    const chk = await screen.findByLabelText(/ativa/i)
    expect(chk).toBeChecked()
    await userEvent.click(chk)
    await waitFor(() => expect(update).toHaveBeenCalledWith('pensao_parcelas', expect.objectContaining({ ativa: false })))
  })
})
