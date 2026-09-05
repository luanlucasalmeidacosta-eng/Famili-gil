import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AbaBens from './AbaBens.jsx'

const insert = vi.fn(async () => ({ error: null }))
const bensNoBanco = [{ id: 'b1', descricao: 'Casa', tipo: 'imovel', valor_mercado: 400000, data_aquisicao: '2018-01-01', forma_aquisicao: 'oneroso', titular: 'parte_a', clausula_incomunicabilidade: false, financiado: false, saldo_devedor: null, classificacao_override: null }]
const configNoBanco = { regime_bens: 'comunhao_parcial', data_casamento: '2015-01-01', data_separacao_fato: null, separacao_fato_efeito: 'corta_comunicacao', data_ajuizamento: null }

vi.mock('../../lib/supabase.js', () => ({
  supabase: { from: (t) => ({
    select: () => ({ eq: () => ({
      order: async () => ({ data: bensNoBanco, error: null }),
      maybeSingle: async () => ({ data: configNoBanco, error: null }),
    }) }),
    insert: (row) => { insert(t, row); return Promise.resolve({ error: null }) },
    update: () => ({ eq: async () => ({ error: null }) }),
    delete: () => ({ eq: async () => ({ error: null }) }),
  }) },
}))

describe('AbaBens', () => {
  it('mostra a classificação prevista do bem já cadastrado', async () => {
    render(<AbaBens caso={{ id: 'c1' }} />)
    await waitFor(() => expect(screen.getByRole('cell', { name: /comunicável/i })).toBeInTheDocument())
    expect(screen.getByText(/CC, art\. 1\.660, I/)).toBeInTheDocument()
  })

  it('cadastra um bem novo', async () => {
    render(<AbaBens caso={{ id: 'c1' }} />)
    await userEvent.type(screen.getByLabelText(/descrição/i), 'Carro')
    await userEvent.type(screen.getByLabelText(/valor de mercado/i), '50000')
    await userEvent.click(screen.getByRole('button', { name: /adicionar bem/i }))
    await waitFor(() => expect(insert).toHaveBeenCalledWith('partilha_bens',
      expect.objectContaining({ caso_id: 'c1', descricao: 'Carro', valor_mercado: 50000 })))
  })
})
