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

  it('gravar com erro: não lança, apenas segue (best-effort)', async () => {
    const sb = fakeSupabase({ upsertError: { message: 'boom' } })
    await expect(criarCachePort(sb).gravar('IPCA', [{ ref: '2024-09-01', valor: 1 }])).resolves.toBeUndefined()
  })
})

import { criarCachePortFocus } from './cache-indices.js'

function supaFocus(rows, { onUpsert } = {}) {
  return {
    from: () => ({
      select: () => ({ eq: () => ({ gte: () => ({ lte: async () => ({ data: rows, error: null }) }) }) }),
      upsert: async (r) => { onUpsert?.(r); return { error: null } },
    }),
  }
}

describe('criarCachePortFocus', () => {
  it('ler: devolve o boletim mais recente do intervalo', async () => {
    const rows = [
      { serie: 'IPCA', competencia: '2026-10-01', mediana: 0.30, data_boletim: '2026-08-29' },
      { serie: 'IPCA', competencia: '2026-10-01', mediana: 0.32, data_boletim: '2026-09-05' },
      { serie: 'IPCA', competencia: '2026-11-01', mediana: 0.28, data_boletim: '2026-09-05' },
    ]
    const cp = criarCachePortFocus(supaFocus(rows))
    const r = await cp.ler('IPCA', '2026-10-01', '2026-11-01')
    expect(r.dataBoletim).toBe('2026-09-05')
    expect(r.valores).toEqual({ '2026-10-01': 0.32, '2026-11-01': 0.28 })
  })

  it('lerBoletim: filtra por data_boletim exata', async () => {
    const rows = [
      { serie: 'IPCA', competencia: '2026-10-01', mediana: 0.30, data_boletim: '2026-08-29' },
      { serie: 'IPCA', competencia: '2026-10-01', mediana: 0.32, data_boletim: '2026-09-05' },
    ]
    const cp = criarCachePortFocus(supaFocus(rows))
    const r = await cp.lerBoletim('IPCA', '2026-08-29', '2026-10-01', '2026-10-01')
    expect(r.valores).toEqual({ '2026-10-01': 0.30 })
  })

  it('gravar: upsert uma linha por competência', async () => {
    let recebido
    const cp = criarCachePortFocus(supaFocus([], { onUpsert: (r) => { recebido = r } }))
    await cp.gravar('IPCA', '2026-09-05', { '2026-10-01': 0.32, '2026-11-01': 0.28 })
    expect(recebido).toEqual([
      { serie: 'IPCA', competencia: '2026-10-01', mediana: 0.32, data_boletim: '2026-09-05' },
      { serie: 'IPCA', competencia: '2026-11-01', mediana: 0.28, data_boletim: '2026-09-05' },
    ])
  })
})
