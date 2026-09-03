import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

let sessaoAtual = null
vi.mock('./auth/AuthProvider.jsx', async (orig) => {
  const real = await orig()
  return { ...real, useAuth: () => ({ session: sessaoAtual, carregando: false, sair: vi.fn() }) }
})
vi.mock('./pages/Casos.jsx', () => ({ default: () => <div>LISTA DE CASOS</div> }))

import App from './App.jsx'

describe('App (rotas)', () => {
  it('sem sessão em /casos → mostra Login', async () => {
    sessaoAtual = null
    window.history.pushState({}, '', '/casos')
    render(<App />)
    await waitFor(() => expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument())
  })

  it('com sessão em /casos → mostra a lista', async () => {
    sessaoAtual = { user: { email: 'a@x.com' } }
    window.history.pushState({}, '', '/casos')
    render(<App />)
    await waitFor(() => expect(screen.getByText('LISTA DE CASOS')).toBeInTheDocument())
  })
})
