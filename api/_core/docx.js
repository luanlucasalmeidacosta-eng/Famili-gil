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
    new Paragraph((() => {
      const p = memoria.parametros_snapshot?.parametros
      if (!p) return 'Critérios aplicados: —'
      const indice = p.indice_correcao === 'legal'
        ? 'legal (SELIC até 29/08/2024; IPCA + SELIC líquida do IPCA a partir de 30/08/2024)'
        : p.indice_correcao
      const imputacao = { mais_antigas_primeiro: 'parcelas mais antigas primeiro', mais_recentes_primeiro: 'parcelas mais recentes primeiro', pro_rata: 'pró-rata entre as parcelas em aberto' }[p.regra_imputacao] || p.regra_imputacao
      const regimeJuros = p.indice_correcao === 'legal' ? undefined : { '1_am_simples': '1% ao mês, simples', '1_am_capitalizado': '1% ao mês, capitalizado', selic: 'SELIC' }[p.regime_juros_convencionado]
      return `Critérios aplicados: índice de correção ${indice}; imputação de pagamento: ${imputacao}` + (regimeJuros ? `; juros do índice convencionado: ${regimeJuros}.` : '.')
    })()),
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

const ROTULOS_REGIME = {
  comunhao_parcial: 'Comunhão parcial de bens',
  comunhao_universal: 'Comunhão universal de bens',
  separacao_total: 'Separação convencional total',
  participacao_final_aquestos: 'Participação final nos aquestos',
}

const ROTULOS_ORIGEM = { automatica: 'automática', override: 'override (advogado)', pendente: 'pendente' }
const ROTULOS_EFEITO_SEPARACAO = {
  corta_comunicacao: 'corta a comunicação dos bens a partir da separação de fato',
  apenas_alerta: 'não corta a comunicação — apenas sinaliza os bens adquiridos depois',
}

/** @returns {Promise<Uint8Array>} */
export async function partilhaParaDocx(memoria, caso) {
  const config = memoria.entradas_snapshot?.config || {}
  const cenario = memoria.entradas_snapshot?.cenario || {}
  const linhas = memoria.linhas_bens || []
  const fundamentosBens = [...new Set(linhas.map((l) => l.citacao).filter(Boolean))]

  const header = [
    new Paragraph({ text: 'Memória de Partilha de Bens', heading: HeadingLevel.HEADING_1 }),
    new Paragraph(`Parte A: ${caso.parte_a || '—'}   Parte B: ${caso.parte_b || '—'}`),
    new Paragraph(`Processo: ${caso.numero_processo || '—'}   Versão: ${memoria.versao}   Gerado em: ${new Date().toLocaleString('pt-BR')}`),
    new Paragraph(`Cenário: ${cenario.rotulo || '—'}${cenario.pct_parte_a != null ? `   Divisão: ${cenario.pct_parte_a}% / ${100 - Number(cenario.pct_parte_a)}%` : ''}`),
    new Paragraph(`Regime de bens: ${ROTULOS_REGIME[config.regime_bens] || config.regime_bens || '—'}`),
    new Paragraph(`Casamento: ${config.data_casamento || '—'}   Separação de fato: ${config.data_separacao_fato || '—'}   Ajuizamento: ${config.data_ajuizamento || '—'}`),
    ...(config.data_separacao_fato
      ? [new Paragraph(`Efeito da separação de fato: ${ROTULOS_EFEITO_SEPARACAO[config.separacao_fato_efeito] || config.separacao_fato_efeito || '—'}`)]
      : []),
    new Paragraph(''),
  ]

  const tabelaBens = new Table({
    rows: [
      new TableRow({ children: ['Descrição', 'Tipo', 'Valor', 'Líquido', 'Classificação', 'Origem', 'Fundamento', 'Alocado para'].map(cel) }),
      ...linhas.map((l) => new TableRow({
        children: [
          l.descricao, l.tipo, brl(l.valorMercado), brl(l.valorLiquido),
          l.classificacao, ROTULOS_ORIGEM[l.origem] || l.origem || '—', l.citacao || '—', l.alocadoPara || '—',
        ].map(cel),
      })),
    ],
  })

  const q = memoria.quadro_quinhoes
  const tabelaQuinhoes = new Table({
    rows: [
      new TableRow({ children: ['', 'Acervo/aquestos', 'Quinhão ideal', 'Valor alocado', 'Torna'].map(cel) }),
      new TableRow({ children: ['Parte A', brl(q.parteA.acervoLiquido), q.parteA.quinhaoIdealValor != null ? brl(q.parteA.quinhaoIdealValor) : '—', brl(q.parteA.valorAlocado), brl(q.parteA.torna)].map(cel) }),
      new TableRow({ children: ['Parte B', brl(q.parteB.acervoLiquido), q.parteB.quinhaoIdealValor != null ? brl(q.parteB.quinhaoIdealValor) : '—', brl(q.parteB.valorAlocado), brl(q.parteB.torna)].map(cel) }),
    ],
  })

  const tributario = (memoria.alertas_tributarios || []).length
    ? [
        new Paragraph({ text: 'Enquadramento tributário', heading: HeadingLevel.HEADING_2 }),
        // brl() já prefixa "R$ " — não repetir o prefixo aqui.
        ...memoria.alertas_tributarios.map((t) => new Paragraph(`• ${t.tipo} sobre ${brl(t.base)} — ${t.fundamento}`)),
        new Paragraph({ children: [new TextRun({ text: 'O valor do imposto NÃO é calculado aqui — alíquota é municipal/estadual e varia.', italics: true })] }),
      ]
    : []

  const linhaTempo = [
    new Paragraph({ text: 'Linha do tempo', heading: HeadingLevel.HEADING_2 }),
    ...(memoria.linha_tempo || []).flatMap((t) => [
      new Paragraph(`• ${t.intervalo}: ${t.regraComunicacao}`),
      ...(t.alertas || []).map((a) => new Paragraph(`    ⚠ ${a}`)),
    ]),
  ]

  const fundPartilha = [
    new Paragraph(''),
    new Paragraph({ text: 'Fundamentos', heading: HeadingLevel.HEADING_2 }),
    ...fundamentosBens.map((f) => new Paragraph(`• ${f}`)),
  ]
  const alertasGerais = (memoria.alertas || []).length
    ? [new Paragraph({ text: 'Alertas', heading: HeadingLevel.HEADING_2 }), ...memoria.alertas.map((a) => new Paragraph(`• ${a}`))]
    : []
  const rodapePartilha = [
    new Paragraph(''),
    new Paragraph({ children: [new TextRun({ text: 'Documento editável — confira os valores antes de protocolar.', italics: true })] }),
  ]

  const doc = new Document({
    sections: [{ children: [...header, tabelaBens, new Paragraph(''), tabelaQuinhoes, new Paragraph(''), ...tributario, ...linhaTempo, ...fundPartilha, ...alertasGerais, ...rodapePartilha] }],
  })
  const bufPartilha = await Packer.toBuffer(doc)
  return new Uint8Array(bufPartilha)
}
