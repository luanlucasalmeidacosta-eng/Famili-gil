import { describe, it, expect } from 'vitest'
import { criarCachePort } from './cache-indices.js'

function fakeSupabase({ selectData = [], selectError = null, upsertError = null } = {}) {
  const calls = { select: [], upsert: [] }
  return {
    calls,
    from(tabela) {
      expect(tabela).toBe('indices_cache')
      return {
        select() {
          const q = {
            _f: {},
            eq(c, v) { this._f[c] = v; return this },
            gte(c, v) { this._f[`gte_${c}`] = v; return this },
            lte(c, v) { this._f[`lte_${c}`] = v; return this },
            then(res) { calls.select.push(this._f); return Promise.resolve({ data: selectData, error: selectError }).then(res) },
          }
          return q
        },
        upsert(rows, opts) {
          calls.upsert.push({ rows, opts })
          return Promise.resolve({ error: upsertError })
        },
      }
    },
  }
}

describe('criarCachePort', () => {
  it('ler → mapa ref→valor filtrado por série e intervalo', async () => {
    const sb = fakeSupabase({ selectData: [{ ref: '2024-08-01', valor: 0.38 }, { ref: '2024-09-01', valor: 0.44 }] })
    const port = criarCachePort(sb)
    const out = await port.ler('IPCA', '2024-08-01', '2024-09-30')
    expect(out).toEqual({ '2024-08-01': 0.38, '2024-09-01': 0.44 })
    expect(sb.calls.select[0]).toMatchObject({ serie: 'IPCA', gte_ref: '2024-08-01', lte_ref: '2024-09-30' })
  })

  it('gravar → upsert com onConflict serie,ref', async () => {
    const sb = fakeSupabase()
    await criarCachePort(sb).gravar('SELIC_DIARIA', [{ ref: '2024-09-02', valor: 0.04 }])
    expect(sb.calls.upsert[0].rows).toEqual([{ serie: 'SELIC_DIARIA', ref: '2024-09-02', valor: 0.04 }])
    expect(sb.calls.upsert[0].opts).toMatchObject({ onConflict: 'serie,ref' })
  })

  it('gravar propaga erro', async () => {
    const sb = fakeSupabase({ upsertError: { message: 'boom' } })
    await expect(criarCachePort(sb).gravar('IPCA', [{ ref: '2024-09-01', valor: 1 }])).rejects.toThrow('boom')
  })
})
