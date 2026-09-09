import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const navigate = vi.fn()
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig()),
  useNavigate: () => navigate,
}))

const casosNoBanco = [
  { id: 'c1', tipo: 'pensao', titulo: 'Silva x Souza', arquivado: false },
  { id: 'c2', tipo: 'partilha', titulo: 'Silva x Souza', arquivado: true },
]
const insert = vi.fn(async (linha) => ({
  data: [{ id: 'novo', ...linha }], error: null,
}))
vi.mock('../lib/supabase.js', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: (field, value) => ({
          order: async () => ({
            data: casosNoBanco.filter(c => c[field] === value),
            error: null,
          }),
        }),
      }),
      insert: (linha) => ({ select: async () => insert(linha) }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  },
}))

vi.mock('../lib/api.js', () => ({
  apiFetch: vi.fn(async () => ({ ok: true })),
}))

import Casos from './Casos.jsx'
import { apiFetch } from '../lib/api.js'

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

  it('exclui definitivamente um caso arquivado após digitar o título', async () => {
    render(<MemoryRouter><Casos /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: /arquivados/i }))
    await waitFor(() => expect(screen.getByText('Silva x Souza')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /excluir definitivamente/i }))
    // botão de confirmar começa desabilitado
    const confirmar = screen.getByRole('button', { name: /confirmar exclus[ãa]o/i })
    expect(confirmar).toBeDisabled()
    await userEvent.type(screen.getByLabelText(/digite o t[íi]tulo/i), 'Silva x Souza')
    expect(confirmar).toBeEnabled()
    await userEvent.click(confirmar)
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/casos/excluir', expect.objectContaining({
      method: 'POST', body: { casoId: expect.any(String), tituloConfirmacao: 'Silva x Souza' },
    })))
  })
})
