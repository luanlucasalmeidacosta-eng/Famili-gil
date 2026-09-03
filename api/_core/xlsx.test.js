import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { pensaoParaXlsx } from './xlsx.js'

const memoria = {
  versao: 1, data_base: '2024-10-01',
  linhas: [
    { competencia: '2024-09', vencimento: '2024-09-10', valorDevidoOriginal: 1000,
      correcao: { valor: 10, fator: 1.01, criterio: 'IPCA…' }, juros: { valor: 5, criterio: '…' },
      pagamentosAbatidos: [{ valorPago: 200 }], saldoAtualizado: 815 },
  ],
  totais: { somaOriginal: 1000, somaCorrecao: 10, somaJuros: 5, somaPagamentos: 200, saldo: 815 },
}
const caso = { parte_a: 'A', parte_b: 'B', numero_processo: '123' }

describe('pensaoParaXlsx', () => {
  it('gera um .xlsx abrível com a linha e os totais', async () => {
    const bytes = await pensaoParaXlsx(memoria, caso)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(bytes)
    const ws = wb.worksheets[0]
    const textos = []
    ws.eachRow((r) => r.eachCell((c) => textos.push(String(c.value))))
    expect(textos.join(' ')).toContain('2024-09')
    expect(textos.join(' ')).toContain('815')
  })
})
