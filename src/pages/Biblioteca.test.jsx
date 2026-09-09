import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../lib/supabase.js', () => ({
  supabase: { from: () => ({
    select: () => ({ order: async () => ({ data: [
      { slug: 'aliquota_itbi', rotulo: 'Alíquotas de ITBI', ordem: 10 },
      { slug: 'aliquota_itcmd', rotulo: 'Alíquotas de ITCMD', ordem: 20 },
    ], error: null }) }),
  }) },
}))

describe('Biblioteca', () => {
  it('renderiza uma seção por categoria', async () => {
    const { default: Biblioteca } = await import('./Biblioteca.jsx')
    render(<MemoryRouter><Biblioteca /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('Alíquotas de ITBI')).toBeInTheDocument())
    expect(screen.getByText('Alíquotas de ITCMD')).toBeInTheDocument()
  })
})
