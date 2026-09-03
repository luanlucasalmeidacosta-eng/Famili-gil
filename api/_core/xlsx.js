// api/_core/xlsx.js
import ExcelJS from 'exceljs'

/**
 * @param {object} memoria linha de pensao_memoria (linhas/totais/data_base/versao)
 * @param {object} caso linha de casos (parte_a/parte_b/numero_processo)
 * @returns {Promise<Uint8Array>}
 */
export async function pensaoParaXlsx(memoria, caso) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Memória de cálculo')

  ws.addRow([`Exequente: ${caso.parte_a || ''}`, `Executado: ${caso.parte_b || ''}`])
  ws.addRow([`Processo: ${caso.numero_processo || '—'}`, `Data-base: ${memoria.data_base}`, `Versão: ${memoria.versao}`])
  ws.addRow([])
  const head = ['Competência', 'Vencimento', 'Valor original', 'Fator correção', 'Correção (R$)', 'Juros (R$)', 'Pagamentos abatidos (R$)', 'Saldo atualizado']
  ws.addRow(head)

  const first = ws.rowCount + 1
  for (const l of memoria.linhas) {
    const pagos = l.pagamentosAbatidos.reduce((s, p) => s + p.valorPago, 0)
    ws.addRow([l.competencia, l.vencimento, l.valorDevidoOriginal, l.correcao.fator, l.correcao.valor, l.juros.valor, pagos, l.saldoAtualizado])
  }
  const last = ws.rowCount
  ws.addRow([
    'TOTAIS', '', { formula: `SUM(C${first}:C${last})` }, '',
    { formula: `SUM(E${first}:E${last})` }, { formula: `SUM(F${first}:F${last})` },
    { formula: `SUM(G${first}:G${last})` }, { formula: `SUM(H${first}:H${last})` },
  ])

  const buf = await wb.xlsx.writeBuffer()
  return new Uint8Array(buf)
}
