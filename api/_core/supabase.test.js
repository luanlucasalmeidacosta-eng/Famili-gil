import { describe, it, expect } from 'vitest'
import { clienteDoRequest, json } from './supabase.js'

describe('json', () => {
  it('serializa e seta content-type', async () => {
    const r = json({ a: 1 }, 201)
    expect(r.status).toBe(201)
    expect(r.headers.get('content-type')).toContain('application/json')
    expect(await r.json()).toEqual({ a: 1 })
  })
})

describe('clienteDoRequest', () => {
  it('sem Authorization → lança 401', () => {
    const req = new Request('https://x/api/pensao/calcular', { method: 'POST' })
    try {
      clienteDoRequest(req)
      throw new Error('deveria ter lançado')
    } catch (e) {
      expect(e.status).toBe(401)
    }
  })

  it('com Bearer → devolve client e token', () => {
    const req = new Request('https://x', { headers: { Authorization: 'Bearer abc.def.ghi' } })
    const { supabase, userToken } = clienteDoRequest(req, {
      url: 'https://proj.supabase.co', anonKey: 'anon',
    })
    expect(userToken).toBe('abc.def.ghi')
    expect(typeof supabase.from).toBe('function')
  })

  it('sem SUPABASE_URL/ANON_KEY e sem cfg → lança 500', () => {
    const req = new Request('https://x', { headers: { Authorization: 'Bearer abc.def.ghi' } })
    try {
      clienteDoRequest(req) // sem cfg, e as env não estão setadas no ambiente de teste
      throw new Error('deveria ter lançado')
    } catch (e) {
      expect(e.status).toBe(500)
    }
  })
})
