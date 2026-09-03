import { describe, it, expect } from 'vitest'
import { SERIES, janelasDe10Anos, parseSgsJson, buscarSerieNoSgs, resolverSeries } from './indices-bcb.js'

describe('SERIES', () => {
  it('tem os códigos SGS do spec', () => {
    expect(SERIES).toEqual({ SELIC_DIARIA: 11, IPCA: 433, INPC: 188, IGPM: 189, IPCA15: 7478 })
  })
})

describe('janelasDe10Anos', () => {
  it('intervalo curto → uma janela só, em formato BR', () => {
    expect(janelasDe10Anos('2020-01-01', '2024-06-30')).toEqual([
      { inicioBR: '01/01/2020', fimBR: '30/06/2024' },
    ])
  })

  it('intervalo de 25 anos → 3 janelas contíguas de no máx. 10 anos', () => {
    const js = janelasDe10Anos('2000-01-01', '2025-01-01')
    expect(js).toEqual([
      { inicioBR: '01/01/2000', fimBR: '31/12/2009' },
      { inicioBR: '01/01/2010', fimBR: '31/12/2019' },
      { inicioBR: '01/01/2020', fimBR: '01/01/2025' },
    ])
  })

  it('rejeita intervalo invertido', () => {
    expect(() => janelasDe10Anos('2025-01-01', '2020-01-01')).toThrow()
  })
})

describe('parseSgsJson', () => {
  it('série diária → ref = data ISO', () => {
    const out = parseSgsJson([{ data: '30/08/2024', valor: '0.0417' }], 'dia')
    expect(out).toEqual([{ ref: '2024-08-30', valor: 0.0417 }])
  })

  it('série mensal → ref = 1º dia do mês', () => {
    const out = parseSgsJson([{ data: '01/07/2024', valor: '0.38' }], 'mes')
    expect(out).toEqual([{ ref: '2024-07-01', valor: 0.38 }])
  })

  it('descarta entradas sem valor', () => {
    const out = parseSgsJson(
      [{ data: '01/07/2024', valor: '' }, { data: '01/08/2024', valor: '0.02' }],
      'mes',
    )
    expect(out).toEqual([{ ref: '2024-08-01', valor: 0.02 }])
  })
})

function fakeFetchOk(mapaUrlParaPayload) {
  return async (url) => {
    const payload = mapaUrlParaPayload[url] ?? mapaUrlParaPayload['*']
    return { ok: true, status: 200, json: async () => payload }
  }
}

describe('buscarSerieNoSgs', () => {
  it('uma janela: chama o SGS e normaliza', async () => {
    const fetchImpl = fakeFetchOk({
      '*': [{ data: '01/07/2024', valor: '0.38' }, { data: '01/08/2024', valor: '0.02' }],
    })
    const out = await buscarSerieNoSgs({
      codigo: 433, tipoRef: 'mes', inicioISO: '2024-07-01', fimISO: '2024-08-31', fetchImpl,
    })
    expect(out).toEqual([
      { ref: '2024-07-01', valor: 0.38 },
      { ref: '2024-08-01', valor: 0.02 },
    ])
  })

  it('duas janelas (>10 anos): concatena, ordena, deduplica', async () => {
    let chamadas = 0
    const fetchImpl = async () => {
      chamadas += 1
      const payload = chamadas === 1
        ? [{ data: '01/06/2015', valor: '0.5' }]
        : [{ data: '01/06/2015', valor: '0.5' }, { data: '01/06/2021', valor: '0.7' }]
      return { ok: true, status: 200, json: async () => payload }
    }
    const out = await buscarSerieNoSgs({
      codigo: 433, tipoRef: 'mes', inicioISO: '2010-01-01', fimISO: '2022-01-01', fetchImpl,
    })
    expect(chamadas).toBe(2)
    expect(out).toEqual([
      { ref: '2015-06-01', valor: 0.5 },
      { ref: '2021-06-01', valor: 0.7 },
    ])
  })

  it('janela não-OK → lança com série e período', async () => {
    const fetchImpl = async () => ({ ok: false, status: 503, json: async () => ({}) })
    await expect(
      buscarSerieNoSgs({ codigo: 11, tipoRef: 'dia', inicioISO: '2024-01-01', fimISO: '2024-02-01', fetchImpl }),
    ).rejects.toThrow(/11/)
  })
})

const pedidoIPCA = [{ chave: 'IPCA', codigo: 433, tipoRef: 'mes' }]

describe('resolverSeries (cache-first)', () => {
  it('cache cobre o intervalo → NÃO chama o SGS', async () => {
    let fetchChamado = false
    const fetchImpl = async () => { fetchChamado = true; return { ok: true, json: async () => [] } }
    const cachePort = {
      ler: async () => ({ '2024-07-01': 0.38, '2024-08-01': 0.02 }),
      gravar: async () => { throw new Error('não deveria gravar') },
    }
    const out = await resolverSeries({
      pedidos: pedidoIPCA, inicioISO: '2024-07-01', fimISO: '2024-08-31', cachePort, fetchImpl,
    })
    expect(fetchChamado).toBe(false)
    expect(out).toEqual({ IPCA: { '2024-07-01': 0.38, '2024-08-01': 0.02 } })
  })

  it('cache vazio → busca no SGS, grava e retorna', async () => {
    const gravados = []
    const fetchImpl = async () => ({ ok: true, json: async () => [{ data: '01/08/2024', valor: '0.02' }] })
    const cachePort = {
      ler: async () => ({}),
      gravar: async (chave, dados) => { gravados.push([chave, dados]) },
    }
    const out = await resolverSeries({
      pedidos: pedidoIPCA, inicioISO: '2024-08-01', fimISO: '2024-08-31', cachePort, fetchImpl,
    })
    expect(out).toEqual({ IPCA: { '2024-08-01': 0.02 } })
    expect(gravados).toEqual([['IPCA', [{ ref: '2024-08-01', valor: 0.02 }]]])
  })

  it('cache vazio + SGS fora do ar → propaga erro', async () => {
    const fetchImpl = async () => ({ ok: false, status: 503, json: async () => ({}) })
    const cachePort = { ler: async () => ({}), gravar: async () => {} }
    await expect(
      resolverSeries({ pedidos: pedidoIPCA, inicioISO: '2024-08-01', fimISO: '2024-08-31', cachePort, fetchImpl }),
    ).rejects.toThrow(/433/)
  })
})
