import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const apiFetch = vi.fn()
vi.mock('../../lib/api.js', () => ({ apiFetch: (...a) => apiFetch(...a), apiFetchBlob: vi.fn() }))
vi.mock('../../lib/supabase.js', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: [{ versao: 1 }], error: null }) }) }) }) },
}))
import AbaMemoria from './AbaMemoria.jsx'

const memoria = {
  versao: 1, data_base: '2024-10-01',
  linhas: [{ parcelaId: 'p1', competencia: '2024-09', vencimento: '2024-09-10', valorDevidoOriginal: 1000,
    correcao: { valor: 10, fator: 1.01, criterio: 'IPCA…' }, juros: { valor: 5, criterio: '…' },
    pagamentosAbatidos: [], saldoAtualizado: 1015, fundamentos: ['CC, art. 397'] }],
  totais: { somaOriginal: 1000, somaCorrecao: 10, somaJuros: 5, somaPagamentos: 0, saldo: 1015 },
  alertas: ['Parcela 2024-09 vence antes da citação (01/10/2024); …'],
}

describe('AbaMemoria', () => {
  it('calcula e mostra a tabela + alerta', async () => {
    apiFetch.mockResolvedValueOnce({ memoriaId: 'm1', versao: 1 }) // calcular
      .mockResolvedValueOnce(memoria) // GET memoria
    render(<AbaMemoria caso={{ id: 'c1' }} />)
    await userEvent.type(screen.getByLabelText(/data-base/i), '2024-10-01')
    await userEvent.click(screen.getByRole('button', { name: /calcular/i }))
    await waitFor(() => expect(screen.getByText(/Competência/)).toBeInTheDocument())
    expect(screen.getByRole('alert')).toHaveTextContent(/vence antes da citação/)
    expect(screen.getByText(/TOTAIS/)).toBeInTheDocument()
  })

  it('erro 503 do calcular → mensagem, sem tabela', async () => {
    apiFetch.mockRejectedValueOnce(new Error('Índice IPCA indisponível para 10/2024.'))
    render(<AbaMemoria caso={{ id: 'c1' }} />)
    await userEvent.type(screen.getByLabelText(/data-base/i), '2024-10-01')
    await userEvent.click(screen.getByRole('button', { name: /calcular/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/indisponível/))
  })
})
