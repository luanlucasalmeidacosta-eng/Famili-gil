import { describe, it, expect } from 'vitest'
import { buscarMemoria } from './memoria.js'

function sb(rowsPorVersao) {
  return {
    from() {
      const b = {
        select: () => b, eq: () => b, order: () => b, limit: () => b,
        maybeSingle: () => Promise.resolve({ data: rowsPorVersao, error: null }),
      }
      return b
    },
  }
}

describe('buscarMemoria', () => {
  it('sem versão → devolve o registro (mais recente, via order+limit)', async () => {
    const m = await buscarMemoria({ supabase: sb({ id: 'm2', versao: 2 }), casoId: 'c1' })
    expect(m).toMatchObject({ id: 'm2', versao: 2 })
  })
  it('não achou → null', async () => {
    const m = await buscarMemoria({ supabase: sb(null), casoId: 'c1', versao: 9 })
    expect(m).toBeNull()
  })
  it('com versão específica → retorna a versão solicitada', async () => {
    const sbMultiVersao = {
      from() {
        let versaoFiltrada = null
        const mapa = { '1': { id: 'm1', versao: 1 }, '2': { id: 'm2', versao: 2 } }
        const b = {
          select: () => b,
          eq: (col, val) => {
            if (col === 'versao') versaoFiltrada = String(val)
            return b
          },
          order: () => b,
          limit: () => b,
          maybeSingle: () => Promise.resolve({ data: versaoFiltrada ? mapa[versaoFiltrada] : null, error: null }),
        }
        return b
      },
    }
    const m = await buscarMemoria({ supabase: sbMultiVersao, casoId: 'c1', versao: 1 })
    expect(m).toMatchObject({ id: 'm1', versao: 1 })
  })
  it('duas versões para comparação (ambas encontradas)', async () => {
    const sbComparacao = {
      from() {
        let versaoFiltrada = null
        const mapa = { '1': { id: 'm1', versao: 1 }, '2': { id: 'm2', versao: 2 } }
        const b = {
          select: () => b,
          eq: (col, val) => {
            if (col === 'versao') versaoFiltrada = String(val)
            return b
          },
          order: () => b,
          limit: () => b,
          maybeSingle: () => Promise.resolve({ data: versaoFiltrada ? mapa[versaoFiltrada] : null, error: null }),
        }
        return b
      },
    }
    const m1 = await buscarMemoria({ supabase: sbComparacao, casoId: 'c1', versao: 1 })
    const m2 = await buscarMemoria({ supabase: sbComparacao, casoId: 'c1', versao: 2 })
    expect([m1, m2]).toEqual([{ id: 'm1', versao: 1 }, { id: 'm2', versao: 2 }])
  })
  it('comparar com uma versão não encontrada → retorna null para detectar erro 404', async () => {
    const sbParcial = {
      from() {
        let versaoFiltrada = null
        const mapa = { '1': { id: 'm1', versao: 1 } }
        const b = {
          select: () => b,
          eq: (col, val) => {
            if (col === 'versao') versaoFiltrada = String(val)
            return b
          },
          order: () => b,
          limit: () => b,
          maybeSingle: () => Promise.resolve({ data: versaoFiltrada ? mapa[versaoFiltrada] : null, error: null }),
        }
        return b
      },
    }
    const m1 = await buscarMemoria({ supabase: sbParcial, casoId: 'c1', versao: 1 })
    const m9 = await buscarMemoria({ supabase: sbParcial, casoId: 'c1', versao: 9 })
    expect(m1).toMatchObject({ id: 'm1', versao: 1 })
    expect(m9).toBeNull()
  })
})
