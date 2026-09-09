import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const apiFetch = vi.fn()
vi.mock('../../lib/api.js', () => ({ apiFetch: (...a) => apiFetch(...a) }))

const insert = vi.fn(async () => ({ error: null }))
const updateBib = vi.fn(async () => ({ error: null }))
const configNoBanco = { regime_bens: 'comunhao_parcial', data_casamento: '2015-01-01', data_separacao_fato: null, separacao_fato_efeito: 'corta_comunicacao', data_ajuizamento: null, uf: 'SP', municipio: 'São Paulo' }
const bensNoBanco = [{ id: 'b1', descricao: 'Casa', forma_aquisicao: 'oneroso', data_aquisicao: '2018-01-01', titular: 'parte_a', clausula_incomunicabilidade: false, classificacao_override: null }]
const cenariosNoBanco = [{ id: 'cen1', rotulo: 'Proposta 50/50', pct_parte_a: 50, alocacoes: [], tornas: [] }]
const memoriasNoBanco = [{ versao: 2, cenario_id: 'cen1' }, { versao: 1, cenario_id: 'cen1' }]
const aliquotasBibNoBanco = [{ id: 'a-itbi-sp', tipo: 'itbi', uf: 'SP', municipio: 'São Paulo', aliquota: 3, faixas: [], norma: 'Lei X' }]

const porTabela = {
  partilha_bens: bensNoBanco,
  partilha_cenarios: cenariosNoBanco,
  partilha_memoria: memoriasNoBanco,
  aliquotas_biblioteca: aliquotasBibNoBanco,
}

vi.mock('../../lib/supabase.js', () => ({
  supabase: { from: (t) => {
    const result = { data: porTabela[t] || [], error: null }
    return {
      select: () => ({
        eq: () => ({
          order: async () => result,
          maybeSingle: async () => ({ data: t === 'partilha_config' ? configNoBanco : null, error: null }),
        }),
        then: (resolve) => resolve(result),
      }),
      insert: (row) => { insert(t, row); return Promise.resolve({ error: null }) },
      update: (patch) => ({ eq: () => { updateBib(t, patch); return Promise.resolve({ error: null }) } }),
    }
  } },
}))

beforeEach(() => {
  insert.mockClear()
  updateBib.mockClear()
})

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

  it('pré-preenche a alíquota de ITBI a partir da biblioteca e grava tributario_input no cenário', async () => {
    const { default: AbaCenarios } = await import('./AbaCenarios.jsx')
    render(<AbaCenarios caso={{ id: 'c1' }} />)
    await waitFor(() => expect(screen.getByLabelText(/al[íi]quota de itbi/i)).toHaveValue(3))
    await userEvent.type(screen.getByLabelText(/rótulo/i), 'Proposta A')
    await userEvent.click(screen.getByRole('button', { name: /salvar cen[áa]rio/i }))
    await waitFor(() => expect(insert).toHaveBeenCalledWith('partilha_cenarios',
      expect.objectContaining({
        tributario_input: expect.objectContaining({ itbi: { aliquota: 3, norma: 'Lei X' } }),
      }),
    ))
  })

  it('abre o modal de conflito quando a alíquota de ITBI diverge da biblioteca', async () => {
    const { default: AbaCenarios } = await import('./AbaCenarios.jsx')
    render(<AbaCenarios caso={{ id: 'c1' }} />)
    const campo = await screen.findByLabelText(/al[íi]quota de itbi/i)
    await waitFor(() => expect(campo).toHaveValue(3))
    await userEvent.clear(campo)
    await userEvent.type(campo, '2')
    await userEvent.type(screen.getByLabelText(/rótulo/i), 'Proposta B')
    await userEvent.click(screen.getByRole('button', { name: /salvar cen[áa]rio/i }))
    await waitFor(() => expect(screen.getByText(/atualizar a biblioteca/i)).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /^atualizar$/i }))
    await waitFor(() => expect(updateBib).toHaveBeenCalledWith('aliquotas_biblioteca',
      expect.objectContaining({ aliquota: 2, norma: 'Lei X' })))
  })

  it('preenchendo só a alíquota da última faixa do ITCMD + norma, grava itcmd com faixa aberta', async () => {
    const { default: AbaCenarios } = await import('./AbaCenarios.jsx')
    render(<AbaCenarios caso={{ id: 'c1' }} />)
    await screen.findByLabelText(/al[íi]quota de itbi/i)
    await userEvent.type(screen.getByLabelText(/rótulo/i), 'Proposta ITCMD')
    const inputsAliquota = screen.getAllByLabelText(/al[íi]quota da faixa/i)
    await userEvent.type(inputsAliquota[inputsAliquota.length - 1], '7')
    await userEvent.type(screen.getByLabelText(/norma do itcmd/i), 'Lei Estadual nº 10.705/2000')
    await userEvent.click(screen.getByRole('button', { name: /salvar cen[áa]rio/i }))
    await waitFor(() => expect(insert).toHaveBeenCalledWith('partilha_cenarios',
      expect.objectContaining({
        tributario_input: expect.objectContaining({
          itcmd: { faixas: [{ ate: null, aliquota: 7 }], norma: 'Lei Estadual nº 10.705/2000' },
        }),
      }),
    ))
  })

  it('rejeita alíquota de ITBI em branco com a norma preenchida, sem gravar', async () => {
    const { default: AbaCenarios } = await import('./AbaCenarios.jsx')
    render(<AbaCenarios caso={{ id: 'c1' }} />)
    const campo = await screen.findByLabelText(/al[íi]quota de itbi/i)
    await waitFor(() => expect(campo).toHaveValue(3))
    await userEvent.clear(campo) // norma continua pré-preenchida ('Lei X')
    await userEvent.type(screen.getByLabelText(/rótulo/i), 'Proposta ITBI inválida')
    await userEvent.click(screen.getByRole('button', { name: /salvar cen[áa]rio/i }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/al[íi]quota de itbi v[áa]lida/i))
    expect(insert).not.toHaveBeenCalled()
  })

  it('rejeita faixa de ITCMD com teto preenchido e alíquota em branco, sem gravar', async () => {
    const { default: AbaCenarios } = await import('./AbaCenarios.jsx')
    render(<AbaCenarios caso={{ id: 'c1' }} />)
    await screen.findByLabelText(/al[íi]quota de itbi/i)
    await userEvent.type(screen.getByLabelText(/rótulo/i), 'Proposta C')
    await userEvent.type(screen.getByLabelText(/^teto da faixa 1$/i), '100000')
    await userEvent.click(screen.getByRole('button', { name: /salvar cen[áa]rio/i }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/al[íi]quota/i))
    expect(insert).not.toHaveBeenCalled()
  })
})
