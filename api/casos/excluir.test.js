import { describe, it, expect } from 'vitest'
import { processarExclusao } from './excluir.js'

function mkSupabase(caso, { onDelete } = {}) {
  return {
    from: (t) => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: caso, error: null }) }) }),
      delete: () => ({ eq: async (col, val) => { onDelete?.(t, col, val); return { error: null } } }),
    }),
  }
}
function mkStorage({ listData = [], removeErr = null } = {}) {
  return {
    from: () => ({
      list: async () => ({ data: listData, error: null }),
      remove: async () => ({ data: null, error: removeErr }),
    }),
  }
}

describe('processarExclusao', () => {
  it('recusa quando o título não confere', async () => {
    const supa = mkSupabase({ id: 'c1', titulo: 'Silva x Souza', arquivado: true })
    await expect(processarExclusao({ supabase: supa, storage: mkStorage(), casoId: 'c1', tituloConfirmacao: 'errado' }))
      .rejects.toMatchObject({ status: 422 })
  })

  it('recusa quando o caso não está arquivado', async () => {
    const supa = mkSupabase({ id: 'c1', titulo: 'X', arquivado: false })
    await expect(processarExclusao({ supabase: supa, storage: mkStorage(), casoId: 'c1', tituloConfirmacao: 'X' }))
      .rejects.toMatchObject({ status: 422 })
  })

  it('404 quando o caso não existe', async () => {
    const supa = mkSupabase(null)
    await expect(processarExclusao({ supabase: supa, storage: mkStorage(), casoId: 'c1', tituloConfirmacao: 'X' }))
      .rejects.toMatchObject({ status: 404 })
  })

  it('502 e NÃO apaga a linha quando a limpeza do Storage falha', async () => {
    let apagou = false
    const supa = mkSupabase({ id: 'c1', titulo: 'X', arquivado: true }, { onDelete: () => { apagou = true } })
    const storage = mkStorage({ listData: [{ name: 'a.pdf' }], removeErr: new Error('boom') })
    await expect(processarExclusao({ supabase: supa, storage, casoId: 'c1', tituloConfirmacao: 'X' }))
      .rejects.toMatchObject({ status: 502 })
    expect(apagou).toBe(false)
  })

  it('pagina o list do Storage (100 + 30) e remove todos os 130 anexos', async () => {
    const pag1 = Array.from({ length: 100 }, (_, i) => ({ name: `f${i}.pdf` }))
    const pag2 = Array.from({ length: 30 }, (_, i) => ({ name: `g${i}.pdf` }))
    const listCalls = []
    let removed = null
    const supa = mkSupabase({ id: 'c1', titulo: 'X', arquivado: true })
    const storage = { from: () => ({
      list: async (prefix, opts) => { listCalls.push(opts); return { data: listCalls.length === 1 ? pag1 : pag2, error: null } },
      remove: async (paths) => { removed = paths; return { data: null, error: null } },
    }) }
    const out = await processarExclusao({ supabase: supa, storage, casoId: 'c1', tituloConfirmacao: 'X' })
    expect(out).toEqual({ ok: true })
    expect(listCalls).toEqual([{ limit: 100, offset: 0 }, { limit: 100, offset: 100 }])
    expect(removed).toHaveLength(130)
    expect(removed[0]).toBe('c1/f0.pdf')
    expect(removed[129]).toBe('c1/g29.pdf')
  })

  it('502 e preserva a linha quando uma página do list falha', async () => {
    let apagou = false
    const supa = mkSupabase({ id: 'c1', titulo: 'X', arquivado: true }, { onDelete: () => { apagou = true } })
    let n = 0
    const storage = { from: () => ({
      list: async () => { n++; return n === 1
        ? { data: Array.from({ length: 100 }, (_, i) => ({ name: `f${i}.pdf` })), error: null }
        : { data: null, error: new Error('paginacao falhou') } },
      remove: async () => ({ data: null, error: null }),
    }) }
    await expect(processarExclusao({ supabase: supa, storage, casoId: 'c1', tituloConfirmacao: 'X' }))
      .rejects.toMatchObject({ status: 502 })
    expect(apagou).toBe(false)
  })

  it('sucesso: limpa o Storage e apaga a linha casos', async () => {
    const deletes = []
    const supa = mkSupabase({ id: 'c1', titulo: 'X', arquivado: true }, { onDelete: (t, c, v) => deletes.push([t, c, v]) })
    const storage = mkStorage({ listData: [{ name: 'a.pdf' }, { name: 'b.pdf' }] })
    const out = await processarExclusao({ supabase: supa, storage, casoId: 'c1', tituloConfirmacao: 'X' })
    expect(out).toEqual({ ok: true })
    expect(deletes).toEqual([['casos', 'id', 'c1']])
  })
})
