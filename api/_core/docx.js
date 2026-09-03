// api/_core/docx.js
import { Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell, TextRun } from 'docx'

const brl = (n) => `R$ ${Number(n).toFixed(2).replace('.', ',')}`
const cel = (t) => new TableCell({ children: [new Paragraph(String(t))] })

/** @returns {Promise<Uint8Array>} */
export async function pensaoParaDocx(memoria, caso) {
  const linhas = memoria.linhas || []
  const fundamentos = [...new Set(linhas.flatMap((l) => l.fundamentos || []))]

  const header = [
    new Paragraph({ text: 'Memória de cálculo — Execução de Pensão Alimentícia', heading: HeadingLevel.HEADING_1 }),
    new Paragraph(`Exequente: ${caso.parte_a || '—'}   Executado: ${caso.parte_b || '—'}`),
    new Paragraph(`Processo: ${caso.numero_processo || '—'}   Data-base: ${memoria.data_base}   Versão: ${memoria.versao}`),
    new Paragraph('Critério de arredondamento: 2 casas, meio para cima, por parcela. Atualização pró-rata die.'),
    new Paragraph(''),
  ]

  const tabela = new Table({
    rows: [
      new TableRow({ children: ['Competência', 'Vencimento', 'Valor original', 'Correção', 'Juros', 'Pagamentos', 'Saldo'].map(cel) }),
      ...linhas.map((l) => new TableRow({
        children: [
          l.competencia, l.vencimento, brl(l.valorDevidoOriginal), brl(l.correcao.valor),
          brl(l.juros.valor), brl(l.pagamentosAbatidos.reduce((s, p) => s + p.valorPago, 0)), brl(l.saldoAtualizado),
        ].map(cel),
      })),
      new TableRow({ children: [
        'TOTAIS', '', brl(memoria.totais.somaOriginal), brl(memoria.totais.somaCorrecao),
        brl(memoria.totais.somaJuros), brl(memoria.totais.somaPagamentos), brl(memoria.totais.saldo),
      ].map(cel) }),
    ],
  })

  const fund = [
    new Paragraph(''),
    new Paragraph({ text: 'Fundamentos', heading: HeadingLevel.HEADING_2 }),
    ...fundamentos.map((f) => new Paragraph(`• ${f}`)),
  ]
  const alertas = (memoria.alertas || []).length
    ? [new Paragraph({ text: 'Alertas', heading: HeadingLevel.HEADING_2 }), ...memoria.alertas.map((a) => new Paragraph(`• ${a}`))]
    : []
  const rodape = [
    new Paragraph(''),
    new Paragraph({ children: [new TextRun({ text: 'Documento editável — confira os valores antes de protocolar.', italics: true })] }),
  ]

  const doc = new Document({ sections: [{ children: [...header, tabela, ...fund, ...alertas, ...rodape] }] })
  const buf = await Packer.toBuffer(doc)
  return new Uint8Array(buf)
}
