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

  it('sucesso: limpa o Storage e apaga a linha casos', async () => {
    const deletes = []
    const supa = mkSupabase({ id: 'c1', titulo: 'X', arquivado: true }, { onDelete: (t, c, v) => deletes.push([t, c, v]) })
    const storage = mkStorage({ listData: [{ name: 'a.pdf' }, { name: 'b.pdf' }] })
    const out = await processarExclusao({ supabase: supa, storage, casoId: 'c1', tituloConfirmacao: 'X' })
    expect(out).toEqual({ ok: true })
    expect(deletes).toEqual([['casos', 'id', 'c1']])
  })
})
