import { describe, it, expect } from 'vitest'
import { buscarMemoria } from './memoria.js'

function sb(rows) {
  return {
    from() {
      const b = {
        select: () => b, eq: () => b,
        order: () => b, limit: () => b,
        maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
      }
      return b
    },
  }
}

describe('buscarMemoria', () => {
  it('sem versão → devolve a mais recente', async () => {
    const m = await buscarMemoria({ supabase: sb([{ id: 'm2', versao: 2 }]), casoId: 'c1' })
    expect(m).toMatchObject({ id: 'm2', versao: 2 })
  })
  it('não achou → null', async () => {
    const m = await buscarMemoria({ supabase: sb([]), casoId: 'c1', versao: 9 })
    expect(m).toBeNull()
  })
})
