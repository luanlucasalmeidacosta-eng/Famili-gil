import { describe, it, expect } from 'vitest'

describe('infra de testes', () => {
  it('roda e enxerga jsdom', () => {
    const el = document.createElement('div')
    el.textContent = 'ok'
    expect(el.textContent).toBe('ok')
  })
})
