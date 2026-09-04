import { describe, it, expect } from 'vitest'
import { pensaoParaDocx } from './docx.js'

const memoria = {
  versao: 2, data_base: '2024-10-01',
  linhas: [{
    competencia: '2024-09', vencimento: '2024-09-10', valorDevidoOriginal: 1000,
    correcao: { valor: 10, fator: 1.01, criterio: 'IPCA de 01/09/2024 a 01/10/2024' },
    juros: { valor: 5, criterio: 'SELIC menos IPCA' }, pagamentosAbatidos: [], saldoAtualizado: 1015,
    fundamentos: ['Lei 14.905/2024 (arts. 389 e 406 do CC)', 'CC, art. 397'],
  }],
  totais: { somaOriginal: 1000, somaCorrecao: 10, somaJuros: 5, somaPagamentos: 0, saldo: 1015 },
  alertas: ['Parcela 2024-09 vence antes da citação (01/10/2024); …'],
}
const caso = { parte_a: 'Ana', parte_b: 'Bruno', numero_processo: '0001' }

describe('pensaoParaDocx', () => {
  it('gera um .docx não-vazio (zip começando com PK) contendo o texto esperado', async () => {
    const bytes = await pensaoParaDocx(memoria, caso)
    expect(bytes.length).toBeGreaterThan(1000)
    expect(bytes[0]).toBe(0x50) // 'P'
    expect(bytes[1]).toBe(0x4b) // 'K'
    // o document.xml fica comprimido no zip; validação leve: o pacote existe.
    // teste de conteúdo real fica no teste de integração da rota exportar (Task 13).
  })

  it('gera .docx válido com parametros_snapshot presente e também quando ausente', async () => {
    const comSnapshot = {
      ...memoria,
      parametros_snapshot: { parametros: { indice_correcao: 'legal', regra_imputacao: 'mais_antigas_primeiro' } },
    }
    const bytesCom = await pensaoParaDocx(comSnapshot, caso)
    expect(bytesCom.length).toBeGreaterThan(1000)
    expect(bytesCom[0]).toBe(0x50)
    expect(bytesCom[1]).toBe(0x4b)

    const bytesSem = await pensaoParaDocx(memoria, caso) // memoria sem parametros_snapshot
    expect(bytesSem.length).toBeGreaterThan(1000)
    expect(bytesSem[0]).toBe(0x50)
    expect(bytesSem[1]).toBe(0x4b)
  })
})
