import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabase.js', () => {
  const getSession = vi.fn(async () => ({ data: { session: { access_token: 'tok123' } } }))
  return { supabase: { auth: { getSession } } }
})
import { apiFetch } from './api.js'
import { supabase } from './supabase.js'

const getSession = supabase.auth.getSession

describe('apiFetch', () => {
  beforeEach(() => { vi.restoreAllMocks(); getSession.mockClear() })

  it('manda Authorization Bearer e devolve JSON no ok', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ memoriaId: 'm1' }) }))
    const out = await apiFetch('/api/pensao/calcular', { method: 'POST', body: { casoId: 'c1' } })
    expect(out).toEqual({ memoriaId: 'm1' })
    expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer tok123')
  })

  it('lança com a mensagem do erro no !ok', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, json: async () => ({ erro: 'Índice indisponível' }) }))
    await expect(apiFetch('/api/pensao/calcular', { method: 'POST', body: {} })).rejects.toThrow('Índice indisponível')
  })
})
