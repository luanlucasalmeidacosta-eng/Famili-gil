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
  linha_tempo: [
    { intervalo: 'antes_casamento', de: null, ate: '2010-05-01', regraComunicacao: 'x', bensNoIntervalo: [], alertas: [] },
    { intervalo: 'constancia', de: '2010-05-01', ate: null, regraComunicacao: 'x', bensNoIntervalo: ['b1'], alertas: ['Verificar data de aquisição do bem b1'] },
  ],
  alertas_tributarios: [{ tipo: 'ITBI', base: 200000, fundamento: 'Súmula 116 do STF' }],
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

  it('renderiza a linha do tempo com rótulos, período e alertas', async () => {
    apiFetch.mockResolvedValueOnce(memoria)
    const { default: AbaMemoria } = await import('./AbaMemoria.jsx')
    render(<AbaMemoria caso={{ id: 'c1' }} />)
    await waitFor(() => expect(screen.getByText('Antes do casamento')).toBeInTheDocument())
    expect(screen.getByText('Constância do casamento/união')).toBeInTheDocument()
    expect(screen.getByText(/Verificar data de aquisição do bem b1/)).toBeInTheDocument()
  })

  it('mostra quinhão ideal (% e R$) e valor alocado por parte', async () => {
    apiFetch.mockResolvedValueOnce(memoria)
    const { default: AbaMemoria } = await import('./AbaMemoria.jsx')
    render(<AbaMemoria caso={{ id: 'c1' }} />)
    await waitFor(() => expect(screen.getByText('Quinhão ideal')).toBeInTheDocument())
    expect(screen.getByText('Valor alocado')).toBeInTheDocument()
    // as duas partes têm quinhão ideal de 50% — R$ 200.000,00
    expect(screen.getAllByText('50% — R$ 200000,00')).toHaveLength(2)
    expect(screen.getAllByText('R$ 400000,00').length).toBeGreaterThan(0) // valor alocado da parte A
    expect(screen.getByText('R$ 0,00')).toBeInTheDocument() // valor alocado da parte B
  })
})
