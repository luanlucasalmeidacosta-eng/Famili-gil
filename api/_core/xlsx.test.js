import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { pensaoParaXlsx, partilhaParaXlsx } from './xlsx.js'

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

const memoriaPartilha = {
  versao: 1,
  entradas_snapshot: {
    config: { regime_bens: 'comunhao_parcial', data_casamento: '2015-01-01', data_separacao_fato: '2022-06-01', separacao_fato_efeito: 'corta_comunicacao', data_ajuizamento: null },
    cenario: { rotulo: 'Proposta 50/50', pct_parte_a: 50, alocacoes: [{ bemId: 'b1', para: 'parte_a' }], tornas: [{ de: 'parte_a', para: 'parte_b', valor: 200000, forma: 'dinheiro' }] },
  },
  linhas_bens: [{
    bemId: 'b1', descricao: 'Casa', tipo: 'imovel', valorMercado: 400000, valorLiquido: 400000,
    classificacao: 'comunicavel', regra: 'CC, art. 1.660, I', citacao: 'CC, art. 1.660, I', origem: 'automatica',
    alocadoPara: 'parte_a', quinhaoValor: 400000,
  }],
  quadro_quinhoes: {
    parteA: { acervoLiquido: 400000, quinhaoIdealPct: 50, quinhaoIdealValor: 200000, valorAlocado: 400000, torna: 200000 },
    parteB: { acervoLiquido: 400000, quinhaoIdealPct: 50, quinhaoIdealValor: 200000, valorAlocado: 0, torna: -200000 },
  },
  linha_tempo: [{ intervalo: 'constancia', de: '2015-01-01', ate: null, regraComunicacao: '...', bensNoIntervalo: ['b1'], alertas: [] }],
  alertas_tributarios: [{ tipo: 'ITBI', base: 200000, fundamento: 'Súmula 116 do STF...' }],
  totais: { acervoBruto: 400000, passivosDedutiveis: 0, acervoLiquido: 400000, somaTornas: 200000 },
  alertas: [],
}
const casoPartilha = { parte_a: 'Ana', parte_b: 'Bruno', numero_processo: '0002' }

describe('partilhaParaXlsx', () => {
  it('gera um .xlsx com 4 abas (Bens, Quinhões, Cenário, Tributário)', async () => {
    const bytes = await partilhaParaXlsx(memoriaPartilha, casoPartilha)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(bytes)
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Bens', 'Quinhões', 'Cenário', 'Tributário'])
  })

  const textoDaAba = async (memoria, nome) => {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(await partilhaParaXlsx(memoria, casoPartilha))
    const textos = []
    wb.getWorksheet(nome).eachRow((r) => r.eachCell((c) => textos.push(String(c.value))))
    return textos.join(' | ')
  }

  it('aba Cenário traz os parâmetros, as alocações e as tornas — não só os totais', async () => {
    const texto = await textoDaAba(memoriaPartilha, 'Cenário')
    expect(texto).toContain('Proposta 50/50')
    expect(texto).toContain('Percentual da parte A (%)')
    expect(texto).toContain('Alocações informadas')
    expect(texto).toContain('Casa') // descrição do bem alocado, não o uuid
    expect(texto).toContain('Tornas informadas')
    expect(texto).toContain('dinheiro')
    expect(texto).toContain('Efeito da separação de fato')
    expect(texto).toContain('400000') // acervo bruto continua presente
  })

  it('aba Bens traz a coluna Origem', async () => {
    const texto = await textoDaAba(memoriaPartilha, 'Bens')
    expect(texto).toContain('Origem')
    expect(texto).toContain('automatica')
  })

  it('participação final: totais do cenário não saem zerados', async () => {
    const participacao = {
      ...memoriaPartilha,
      totais: { acervoBruto: 450000, passivosDedutiveis: 0, acervoLiquido: 450000, somaTornas: 0 },
    }
    const texto = await textoDaAba(participacao, 'Cenário')
    expect(texto).toContain('450000')
  })
})
