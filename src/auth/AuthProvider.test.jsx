import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from './AuthProvider.jsx'

vi.mock('../lib/supabase.js', () => {
  const listeners = []
  return {
    supabase: {
      auth: {
        getSession: vi.fn(async () => ({ data: { session: null } })),
        onAuthStateChange: vi.fn((cb) => {
          listeners.push(cb)
          return { data: { subscription: { unsubscribe: vi.fn() } } }
        }),
        signInWithPassword: vi.fn(async ({ email }) =>
          email === 'ok@x.com'
            ? { data: { session: { user: { email } } }, error: null }
            : { data: { session: null }, error: { message: 'credenciais inválidas' } },
        ),
        signOut: vi.fn(async () => ({ error: null })),
      },
    },
  }
})

function Sonda() {
  const { session, carregando, entrar } = useAuth()
  return (
    <div>
      <span data-testid="estado">{carregando ? 'carregando' : session ? 'logado' : 'anon'}</span>
      <button onClick={() => entrar('ok@x.com', 's')}>entrar</button>
    </div>
  )
}

describe('AuthProvider', () => {
  beforeEach(() => vi.clearAllMocks())

  it('começa anônimo depois de carregar a sessão', async () => {
    render(<AuthProvider><Sonda /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('estado')).toHaveTextContent('anon'))
  })

  it('entrar() com credencial boa → logado', async () => {
    render(<AuthProvider><Sonda /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('estado')).toHaveTextContent('anon'))
    await userEvent.click(screen.getByText('entrar'))
    await waitFor(() => expect(screen.getByTestId('estado')).toHaveTextContent('logado'))
  })
})
