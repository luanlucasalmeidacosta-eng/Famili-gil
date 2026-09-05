import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const apiFetch = vi.fn()
vi.mock('../../lib/api.js', () => ({ apiFetch: (...a) => apiFetch(...a) }))

const insert = vi.fn(async () => ({ error: null }))
const configNoBanco = { regime_bens: 'comunhao_parcial', data_casamento: '2015-01-01', data_separacao_fato: null, separacao_fato_efeito: 'corta_comunicacao', data_ajuizamento: null }
const bensNoBanco = [{ id: 'b1', descricao: 'Casa', forma_aquisicao: 'oneroso', data_aquisicao: '2018-01-01', titular: 'parte_a', clausula_incomunicabilidade: false, classificacao_override: null }]
const cenariosNoBanco = [{ id: 'cen1', rotulo: 'Proposta 50/50', pct_parte_a: 50, alocacoes: [], tornas: [] }]
const memoriasNoBanco = [{ versao: 2, cenario_id: 'cen1' }, { versao: 1, cenario_id: 'cen1' }]

const porTabela = { partilha_bens: bensNoBanco, partilha_cenarios: cenariosNoBanco, partilha_memoria: memoriasNoBanco }

vi.mock('../../lib/supabase.js', () => ({
  supabase: { from: (t) => ({
    select: () => ({ eq: () => ({
      order: async () => ({ data: porTabela[t] || [], error: null }),
      maybeSingle: async () => ({ data: configNoBanco, error: null }),
    }) }),
    insert: (row) => { insert(t, row); return Promise.resolve({ error: null }) },
  }) },
}))

describe('AbaCenarios', () => {
  it('cria um cenário alocando o bem comunicável pra parte A', async () => {
    const { default: AbaCenarios } = await import('./AbaCenarios.jsx')
    render(<AbaCenarios caso={{ id: 'c1' }} />)
    await waitFor(() => expect(screen.getByText('Casa')).toBeInTheDocument())
    await userEvent.type(screen.getByLabelText(/rótulo/i), 'Proposta 50/50')
    await userEvent.click(screen.getByRole('button', { name: /salvar cenário/i }))
    await waitFor(() => expect(insert).toHaveBeenCalledWith('partilha_cenarios',
      expect.objectContaining({ caso_id: 'c1', rotulo: 'Proposta 50/50' })))
  })

  it('lista as versões já calculadas de cada cenário', async () => {
    const { default: AbaCenarios } = await import('./AbaCenarios.jsx')
    render(<AbaCenarios caso={{ id: 'c1' }} />)
    await waitFor(() => expect(screen.getByText(/versões calculadas: v1, v2/)).toBeInTheDocument())
  })
})
