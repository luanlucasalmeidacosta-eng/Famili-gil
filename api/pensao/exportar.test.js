import { describe, it, expect } from 'vitest'
import { montarExport } from './exportar.js'

const memoria = {
  id: 'm1', versao: 1, data_base: '2024-10-01',
  linhas: [{ competencia: '2024-09', vencimento: '2024-09-10', valorDevidoOriginal: 1000,
    correcao: { valor: 0, fator: 1, criterio: '—' }, juros: { valor: 0, criterio: '—' },
    pagamentosAbatidos: [], saldoAtualizado: 1000, fundamentos: ['CC, art. 397'] }],
  totais: { somaOriginal: 1000, somaCorrecao: 0, somaJuros: 0, somaPagamentos: 0, saldo: 1000 },
  alertas: [],
}
function sb() {
  return { from(t) {
    const data = t === 'casos' ? { parte_a: 'A', parte_b: 'B', numero_processo: '1' } : memoria
    const b = { select: () => b, eq: () => b, order: () => b, limit: () => b, maybeSingle: () => Promise.resolve({ data, error: null }) }
    return b
  } }
}

describe('montarExport', () => {
  it('xlsx → content-type de planilha e bytes não-vazios', async () => {
    const r = await montarExport({ supabase: sb(), casoId: 'c1', versao: '1', formato: 'xlsx' })
    expect(r.contentType).toMatch(/spreadsheetml/)
    expect(r.bytes.length).toBeGreaterThan(500)
    expect(r.filename).toMatch(/\.xlsx$/)
  })
  it('docx → content-type de Word', async () => {
    const r = await montarExport({ supabase: sb(), casoId: 'c1', versao: '1', formato: 'docx' })
    expect(r.contentType).toMatch(/wordprocessingml/)
    expect(r.filename).toMatch(/\.docx$/)
  })
  it('formato inválido → 400', async () => {
    await expect(montarExport({ supabase: sb(), casoId: 'c1', versao: '1', formato: 'pdf' }))
      .rejects.toMatchObject({ status: 400 })
  })
})
