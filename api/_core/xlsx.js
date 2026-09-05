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

const ROTULOS_EFEITO_SEPARACAO = {
  corta_comunicacao: 'corta a comunicação a partir da separação de fato',
  apenas_alerta: 'não corta a comunicação — apenas sinaliza',
}

/** @returns {Promise<Uint8Array>} */
export async function partilhaParaXlsx(memoria, caso) {
  const wb = new ExcelJS.Workbook()
  const config = memoria.entradas_snapshot?.config || {}
  const cenario = memoria.entradas_snapshot?.cenario || {}

  const wsBens = wb.addWorksheet('Bens')
  wsBens.addRow([`Parte A: ${caso.parte_a || ''}`, `Parte B: ${caso.parte_b || ''}`])
  wsBens.addRow(['Descrição', 'Tipo', 'Valor de mercado', 'Saldo devedor', 'Valor líquido', 'Classificação', 'Origem', 'Alocado para'])
  for (const l of memoria.linhas_bens || []) {
    // A fórmula é C-D (valor de mercado menos saldo devedor), a MESMA conta que o
    // motor faz em `valorLiquido`. Passivos vinculados a um bem específico NÃO são
    // descontados aqui de propósito: no motor eles entram uma única vez, como
    // `passivosDedutiveis` do acervo (aba Cenário), e descontá-los também na linha
    // do bem os contaria em dobro. Ver `apurarAcervo`/`passivoDedutivelComum`.
    const row = wsBens.addRow([
      l.descricao, l.tipo, l.valorMercado, (l.financiado ? l.saldoDevedor || 0 : 0), null,
      l.classificacao, l.origem || '—', l.alocadoPara || '—',
    ])
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
  wsCenario.addRow(['Rótulo do cenário', cenario.rotulo || '—'])
  wsCenario.addRow(['Percentual da parte A (%)', cenario.pct_parte_a != null ? Number(cenario.pct_parte_a) : '—'])
  wsCenario.addRow(['Percentual da parte B (%)', cenario.pct_parte_a != null ? 100 - Number(cenario.pct_parte_a) : '—'])
  wsCenario.addRow(['Versão da memória', memoria.versao])
  if (config.data_separacao_fato) {
    wsCenario.addRow(['Efeito da separação de fato', ROTULOS_EFEITO_SEPARACAO[config.separacao_fato_efeito] || config.separacao_fato_efeito || '—'])
  }
  wsCenario.addRow([])
  wsCenario.addRow(['Acervo bruto', memoria.totais.acervoBruto])
  wsCenario.addRow(['Passivos dedutíveis', memoria.totais.passivosDedutiveis])
  wsCenario.addRow(['Acervo líquido', memoria.totais.acervoLiquido])
  wsCenario.addRow(['Soma das tornas informadas', memoria.totais.somaTornas])

  const descricaoPorBemId = new Map((memoria.linhas_bens || []).map((l) => [l.bemId, l.descricao]))
  wsCenario.addRow([])
  wsCenario.addRow(['Alocações informadas'])
  wsCenario.addRow(['Bem', 'Alocado para', 'Fração da parte A'])
  for (const a of cenario.alocacoes || []) {
    wsCenario.addRow([descricaoPorBemId.get(a.bemId) || a.bemId, a.para || '—', a.fracaoA ?? '—'])
  }
  if ((cenario.alocacoes || []).length === 0) wsCenario.addRow(['— nenhuma alocação informada —'])

  wsCenario.addRow([])
  wsCenario.addRow(['Tornas informadas'])
  wsCenario.addRow(['De', 'Para', 'Valor (R$)', 'Forma'])
  for (const t of cenario.tornas || []) {
    wsCenario.addRow([t.de || '—', t.para || '—', Number(t.valor || 0), t.forma || '—'])
  }
  if ((cenario.tornas || []).length === 0) wsCenario.addRow(['— nenhuma torna informada —'])

  const wsTrib = wb.addWorksheet('Tributário')
  wsTrib.addRow(['Tipo', 'Base (R$)', 'Fundamento'])
  for (const t of memoria.alertas_tributarios || []) wsTrib.addRow([t.tipo, t.base, t.fundamento])
  wsTrib.addRow(['Nota: o valor do imposto NÃO é calculado aqui — alíquota é municipal/estadual e varia.'])

  const bufPartilha = await wb.xlsx.writeBuffer()
  return new Uint8Array(bufPartilha)
}
