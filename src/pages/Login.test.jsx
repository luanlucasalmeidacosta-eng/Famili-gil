import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Login from './Login.jsx'

const entrar = vi.fn(async () => {})
vi.mock('../auth/AuthProvider.jsx', () => ({
  useAuth: () => ({ entrar, session: null, carregando: false }),
}))

describe('Login', () => {
  it('envia e-mail e senha para entrar()', async () => {
    render(<Login />)
    await userEvent.type(screen.getByLabelText(/e-mail/i), 'ana@x.com')
    await userEvent.type(screen.getByLabelText(/senha/i), 'segredo')
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }))
    expect(entrar).toHaveBeenCalledWith('ana@x.com', 'segredo')
  })
})
