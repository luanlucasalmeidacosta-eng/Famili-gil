import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Casos from './Casos.jsx'

const navigate = vi.fn()
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig()),
  useNavigate: () => navigate,
}))

const casosNoBanco = [{ id: 'c1', tipo: 'pensao', titulo: 'Silva x Souza', arquivado: false }]
const insert = vi.fn(async (linha) => ({
  data: [{ id: 'novo', ...linha }], error: null,
}))
vi.mock('../lib/supabase.js', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ order: async () => ({ data: casosNoBanco, error: null }) }) }),
      insert: (linha) => ({ select: async () => insert(linha) }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  },
}))

describe('Casos', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lista os casos do usuário', async () => {
    render(<MemoryRouter><Casos /></MemoryRouter>)
    expect(await screen.findByText('Silva x Souza')).toBeInTheDocument()
  })

  it('cria caso de partilha e navega para ele', async () => {
    render(<MemoryRouter><Casos /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: /novo caso/i }))
    await userEvent.type(screen.getByLabelText(/título/i), 'Partilha ABC')
    await userEvent.click(screen.getByRole('radio', { name: /partilha/i }))
    await userEvent.click(screen.getByRole('button', { name: /criar/i }))
    await waitFor(() => expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ titulo: 'Partilha ABC', tipo: 'partilha' }),
    ))
    expect(navigate).toHaveBeenCalledWith('/caso/novo')
  })
})
