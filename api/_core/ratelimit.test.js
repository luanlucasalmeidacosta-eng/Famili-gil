import { describe, it, expect } from 'vitest'
import { rateLimit, ipDoRequest } from './ratelimit.js'

describe('rateLimit', () => {
  it('libera até o limite e bloqueia depois, na mesma janela', () => {
    const chave = `t-${Math.random()}`
    expect(rateLimit(chave, 2, 1000).ok).toBe(true)
    expect(rateLimit(chave, 2, 1000).ok).toBe(true)
    const terceiro = rateLimit(chave, 2, 1000)
    expect(terceiro.ok).toBe(false)
    expect(terceiro.retryMs).toBeGreaterThan(0)
  })

  it('reabre a janela após janelaMs', async () => {
    const chave = `t-${Math.random()}`
    expect(rateLimit(chave, 1, 20).ok).toBe(true)
    expect(rateLimit(chave, 1, 20).ok).toBe(false)
    await new Promise((r) => setTimeout(r, 30))
    expect(rateLimit(chave, 1, 20).ok).toBe(true)
  })
})

describe('ipDoRequest', () => {
  it('pega o primeiro IP do x-forwarded-for', () => {
    const req = new Request('https://x', { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } })
    expect(ipDoRequest(req)).toBe('1.2.3.4')
  })

  it('cai para "desconhecido" sem cabeçalho', () => {
    const req = new Request('https://x')
    expect(ipDoRequest(req)).toBe('desconhecido')
  })
})
