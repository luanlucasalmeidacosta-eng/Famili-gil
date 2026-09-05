import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const apiFetch = vi.fn()
vi.mock('../../lib/api.js', () => ({ apiFetch: (...a) => apiFetch(...a), apiFetchBlob: vi.fn() }))
vi.mock('../../lib/supabase.js', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: [{ versao: 1, cenario_id: 'cen1' }], error: null }) }) }) }) },
}))

const memoria = {
  versao: 1,
  linhas_bens: [{ bemId: 'b1', descricao: 'Casa', tipo: 'imovel', valorMercado: 400000, valorLiquido: 400000, classificacao: 'comunicavel', citacao: 'CC, art. 1.660, I', alocadoPara: 'parte_a', quinhaoValor: 400000 }],
  quadro_quinhoes: { parteA: { acervoLiquido: 400000, quinhaoIdealPct: 50, quinhaoIdealValor: 200000, valorAlocado: 400000, torna: 200000 }, parteB: { acervoLiquido: 400000, quinhaoIdealPct: 50, quinhaoIdealValor: 200000, valorAlocado: 0, torna: -200000 } },
  linha_tempo: [], alertas_tributarios: [{ tipo: 'ITBI', base: 200000, fundamento: 'Súmula 116 do STF' }],
  totais: { acervoBruto: 400000, passivosDedutiveis: 0, acervoLiquido: 400000, somaTornas: 200000 }, alertas: [],
}

describe('AbaMemoria (partilha)', () => {
  it('carrega e mostra o quadro de bens e o enquadramento tributário', async () => {
    apiFetch.mockResolvedValueOnce(memoria)
    const { default: AbaMemoria } = await import('./AbaMemoria.jsx')
    render(<AbaMemoria caso={{ id: 'c1' }} />)
    await waitFor(() => expect(screen.getByText('Casa')).toBeInTheDocument())
    expect(screen.getByText(/ITBI/)).toBeInTheDocument()
  })
})
