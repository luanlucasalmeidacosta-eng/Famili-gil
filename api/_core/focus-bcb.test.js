import { describe, it, expect, vi } from 'vitest'
import { parseFocusMensal, buscarProjecaoFocus, resolverProjecao } from './focus-bcb.js'

// Nomes de campo confirmados na Task 2 (spike): Indicador / Data / DataReferencia / Mediana.
const CAMPOS = { indicador: 'Indicador', data: 'Data', dataReferencia: 'DataReferencia', mediana: 'Mediana' }
const payload = [
  { Indicador: 'IPCA', Data: '2026-09-05', DataReferencia: '10/2026', Mediana: 0.32 },
  { Indicador: 'IPCA', Data: '2026-09-05', DataReferencia: '11/2026', Mediana: 0.28 },
  { Indicador: 'IPCA', Data: '2026-09-05', DataReferencia: '12/2026', Mediana: 0.40 },
]

describe('parseFocusMensal', () => {
  it('normaliza DataReferencia MM/AAAA → YYYY-MM-01 e extrai a data do boletim', () => {
    const r = parseFocusMensal(payload, CAMPOS)
    expect(r.dataBoletim).toBe('2026-09-05')
    expect(r.valores).toEqual({ '2026-10-01': 0.32, '2026-11-01': 0.28, '2026-12-01': 0.40 })
  })
})

describe('buscarProjecaoFocus', () => {
  it('filtra as competências pedidas do boletim mais recente', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ value: payload }),
    }))
    const r = await buscarProjecaoFocus({
      serie: 'IPCA', competenciaInicioISO: '2026-10-01', competenciaFimISO: '2026-11-01', fetchImpl,
    })
    expect(r.dataBoletim).toBe('2026-09-05')
    expect(r.valores).toEqual({ '2026-10-01': 0.32, '2026-11-01': 0.28 })
    expect(fetchImpl).toHaveBeenCalled()
  })
  it('lança se a resposta não for OK', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 503 }))
    await expect(buscarProjecaoFocus({ serie: 'IPCA', competenciaInicioISO: '2026-10-01', competenciaFimISO: '2026-10-01', fetchImpl }))
      .rejects.toThrow()
  })
})

describe('resolverProjecao', () => {
  it('cache hit: não busca', async () => {
    const cachePortFocus = {
      ler: vi.fn(async () => ({ dataBoletim: '2026-09-05', valores: { '2026-10-01': 0.32 } })),
      gravar: vi.fn(),
    }
    const fetchImpl = vi.fn()
    const r = await resolverProjecao({
      pedidos: [{ serie: 'IPCA' }], competenciaInicioISO: '2026-10-01', competenciaFimISO: '2026-10-01',
      cachePortFocus, fetchImpl,
    })
    expect(r.series.IPCA).toEqual({ '2026-10-01': 0.32 })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
  it('dataBoletimFixada: lê só esse boletim e não busca boletim novo', async () => {
    const cachePortFocus = {
      lerBoletim: vi.fn(async () => ({ valores: { '2026-10-01': 0.30 } })),
      ler: vi.fn(),
      gravar: vi.fn(),
    }
    const fetchImpl = vi.fn()
    const r = await resolverProjecao({
      pedidos: [{ serie: 'IPCA' }], competenciaInicioISO: '2026-10-01', competenciaFimISO: '2026-10-01',
      cachePortFocus, fetchImpl, dataBoletimFixada: '2026-08-29',
    })
    expect(cachePortFocus.lerBoletim).toHaveBeenCalledWith('IPCA', '2026-08-29', '2026-10-01', '2026-10-01')
    expect(r.series.IPCA).toEqual({ '2026-10-01': 0.30 })
    expect(r.dataBoletim).toBe('2026-08-29')
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
