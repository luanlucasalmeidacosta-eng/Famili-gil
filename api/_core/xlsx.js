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

/** @returns {Promise<Uint8Array>} */
export async function partilhaParaXlsx(memoria, caso) {
  const wb = new ExcelJS.Workbook()

  const wsBens = wb.addWorksheet('Bens')
  wsBens.addRow([`Parte A: ${caso.parte_a || ''}`, `Parte B: ${caso.parte_b || ''}`])
  wsBens.addRow(['Descrição', 'Tipo', 'Valor de mercado', 'Saldo devedor', 'Valor líquido', 'Classificação', 'Alocado para'])
  for (const l of memoria.linhas_bens || []) {
    const row = wsBens.addRow([l.descricao, l.tipo, l.valorMercado, l.saldoDevedor || 0, null, l.classificacao, l.alocadoPara || '—'])
    row.getCell(5).value = { formula: `C${row.number}-D${row.number}` }
  }

  const wsQuinhoes = wb.addWorksheet('Quinhões')
  const q = memoria.quadro_quinhoes
  wsQuinhoes.addRow(['', 'Acervo/aquestos', 'Quinhão ideal', 'Valor alocado', 'Torna'])
  const linhaA = wsQuinhoes.addRow(['Parte A', q.parteA.acervoLiquido, q.parteA.quinhaoIdealValor, q.parteA.valorAlocado, null])
  linhaA.getCell(5).value = { formula: `D${linhaA.number}-C${linhaA.number}` }
  const linhaB = wsQuinhoes.addRow(['Parte B', q.parteB.acervoLiquido, q.parteB.quinhaoIdealValor, q.parteB.valorAlocado, null])
  linhaB.getCell(5).value = { formula: `D${linhaB.number}-C${linhaB.number}` }

  const wsCenario = wb.addWorksheet('Cenário')
  wsCenario.addRow(['Acervo bruto', memoria.totais.acervoBruto])
  wsCenario.addRow(['Passivos dedutíveis', memoria.totais.passivosDedutiveis])
  wsCenario.addRow(['Acervo líquido', memoria.totais.acervoLiquido])
  wsCenario.addRow(['Soma das tornas informadas', memoria.totais.somaTornas])

  const wsTrib = wb.addWorksheet('Tributário')
  wsTrib.addRow(['Tipo', 'Base (R$)', 'Fundamento'])
  for (const t of memoria.alertas_tributarios || []) wsTrib.addRow([t.tipo, t.base, t.fundamento])
  wsTrib.addRow(['Nota: o valor do imposto NÃO é calculado aqui — alíquota é municipal/estadual e varia.'])

  const bufPartilha = await wb.xlsx.writeBuffer()
  return new Uint8Array(bufPartilha)
}
