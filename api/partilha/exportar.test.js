import { describe, it, expect } from 'vitest'
import { montarExport } from './exportar.js'

const memoria = {
  id: 'm1', versao: 1, entradas_snapshot: { config: { regime_bens: 'comunhao_parcial' } },
  linhas_bens: [], quadro_quinhoes: { parteA: { acervoLiquido: 0, quinhaoIdealValor: 0, valorAlocado: 0, torna: 0 }, parteB: { acervoLiquido: 0, quinhaoIdealValor: 0, valorAlocado: 0, torna: 0 } },
  linha_tempo: [], alertas_tributarios: [], totais: { acervoBruto: 0, passivosDedutiveis: 0, acervoLiquido: 0, somaTornas: 0 }, alertas: [],
}
function sb() {
  return { from(t) {
    const data = t === 'casos' ? { parte_a: 'A', parte_b: 'B', numero_processo: '1' } : memoria
    const b = { select: () => b, eq: () => b, order: () => b, limit: () => b, maybeSingle: () => Promise.resolve({ data, error: null }) }
    return b
  } }
}

describe('montarExport (partilha)', () => {
  it('xlsx → content-type de planilha', async () => {
    const r = await montarExport({ supabase: sb(), casoId: 'c1', versao: '1', formato: 'xlsx' })
    expect(r.contentType).toMatch(/spreadsheetml/)
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
