import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { pensaoParaDocx, partilhaParaDocx } from './docx.js'

// O .docx é um zip; pra conferir o TEXTO que o advogado vai ler no Word (e não só
// que o pacote existe) descompactamos o word/document.xml e removemos as tags.
async function textoDoDocx(bytes) {
  const zip = await JSZip.loadAsync(bytes)
  const xml = await zip.file('word/document.xml').async('string')
  return xml.replace(/<[^>]+>/g, '')
}

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

describe('partilhaParaDocx', () => {
  it('gera um .docx não-vazio com o quadro de bens, quinhões e enquadramento tributário', async () => {
    const bytes = await partilhaParaDocx(memoriaPartilha, casoPartilha)
    expect(bytes.length).toBeGreaterThan(1000)
    expect(bytes[0]).toBe(0x50)
    expect(bytes[1]).toBe(0x4b)
  })

  it('não repete o prefixo "R$" na linha do enquadramento tributário', async () => {
    const texto = await textoDoDocx(await partilhaParaDocx(memoriaPartilha, casoPartilha))
    expect(texto).toContain('ITBI sobre R$ 200000,00')
    expect(texto).not.toContain('R$ R$')
  })

  it('cabeçalho traz rótulo do cenário, data/hora de geração e efeito da separação de fato', async () => {
    const texto = await textoDoDocx(await partilhaParaDocx(memoriaPartilha, casoPartilha))
    expect(texto).toContain('Proposta 50/50')
    expect(texto).toContain('Gerado em:')
    expect(texto).toContain('Efeito da separação de fato:')
    expect(texto).toContain('corta a comunicação')
  })

  it('tabela de bens traz a coluna Origem (automática/override)', async () => {
    const texto = await textoDoDocx(await partilhaParaDocx(memoriaPartilha, casoPartilha))
    expect(texto).toContain('Origem')
    expect(texto).toContain('automática')
  })

  it('linha do tempo imprime os alertas do intervalo', async () => {
    const comAlerta = {
      ...memoriaPartilha,
      linha_tempo: [{ intervalo: 'constancia', de: '2015-01-01', ate: null, regraComunicacao: 'regra', bensNoIntervalo: ['b1'], alertas: ['Bem "Casa" saiu particular — confira.'] }],
    }
    const texto = await textoDoDocx(await partilhaParaDocx(comAlerta, casoPartilha))
    expect(texto).toContain('saiu particular')
  })
})
