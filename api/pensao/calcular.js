// api/pensao/calcular.js
import { clienteDoRequest, json } from '../_core/supabase.js'
import { SERIES, resolverSeries } from '../_core/indices-bcb.js'
import { criarCachePort, criarCachePortFocus } from '../_core/cache-indices.js'
import { resolverProjecao } from '../_core/focus-bcb.js'
import { arredonda2 } from '../_core/dinheiro.js'
import { calcularMemoria, SERIE_DE_INDICE, FRONTEIRA_LEI, sintetizarSelicDiariaProjetada } from './_motor-pensao.js'

const erro = (msg, status) => Object.assign(new Error(msg), { status })
const comp = (iso) => `${iso.slice(0, 7)}-01`
const brMes = (compISO) => { const [a, m] = compISO.split('-'); return `${m}/${a}` }

function mesesEntre(inicioISO, fimISO) {
  const out = []
  let c = comp(inicioISO)
  const fimC = comp(fimISO)
  while (c <= fimC) {
    out.push(c)
    let [a, m] = c.split('-').map(Number)
    m += 1; if (m > 12) { m = 1; a += 1 }
    c = `${a}-${String(m).padStart(2, '0')}-01`
  }
  return out
}

export async function processarCalculo({
  supabase, casoId, dataBase,
  resolver = resolverSeries, cachePort, fetchImpl,
  permitirProjecao = false, projecoesManuais = [],
  resolverProjecaoImpl = resolverProjecao, cachePortFocus, dataBoletimFixada,
}) {
  const { data: caso } = await supabase.from('casos').select('*').eq('id', casoId).maybeSingle()
  if (!caso) throw erro('Caso não encontrado.', 404)

  const { data: p } = await supabase.from('pensao_parametros').select('*').eq('caso_id', casoId).maybeSingle()
  if (!p) throw erro('Defina os parâmetros da pensão antes de calcular.', 422)

  const { data: parcelas } = await supabase.from('pensao_parcelas').select('*').eq('caso_id', casoId)
  const ativas = (parcelas || []).filter((x) => x.ativa === true)
  if (!ativas.length) throw erro('Nenhuma parcela ativa para calcular.', 422)

  const { data: pagamentos } = await supabase.from('pensao_pagamentos').select('*').eq('caso_id', casoId)

  const inicioISO = ativas.reduce((min, x) => (x.vencimento < min ? x.vencimento : min), ativas[0].vencimento)
  const fimISO = dataBase
  if (fimISO <= inicioISO) throw erro('Data-base deve ser posterior ao primeiro vencimento.', 422)

  const pedidos = [{ chave: 'SELIC_DIARIA', codigo: SERIES.SELIC_DIARIA, tipoRef: 'dia' }]
  const mensal = p.indice_correcao === 'legal' ? 'IPCA' : SERIE_DE_INDICE[p.indice_correcao]
  pedidos.push({ chave: mensal, codigo: SERIES[mensal], tipoRef: 'mes' })

  let series
  try {
    series = await resolver({ pedidos, inicioISO, fimISO, cachePort, fetchImpl })
  } catch {
    throw erro('Índices indisponíveis no momento (falha ao consultar o Banco Central). Tente novamente em alguns minutos.', 503)
  }

  // data-base não pode passar da última competência fechada (salvo modo projeção)
  const serieMensal = series[mensal] || {}
  const ultimaComp = Object.keys(serieMensal).sort().at(-1)
  if (ultimaComp == null) {
    throw erro(`Índice ${mensal} indisponível para o período. Tente novamente em alguns minutos.`, 503)
  }

  const regimeUsaSelic = p.indice_correcao === 'legal' ? true : p.regime_juros_convencionado === 'selic'
  const compDataBase = comp(dataBase)
  const selic = series.SELIC_DIARIA || {}
  let projecaoInfo = null

  if (compDataBase > ultimaComp) {
    if (!permitirProjecao) {
      throw erro(
        `Índice fechado disponível apenas até ${brMes(ultimaComp)}. Ajuste a data-base ou habilite a projeção.`,
        422,
      )
    }

    const mesesProjetar = mesesEntre(inicioISO, fimISO).filter((c) => c > ultimaComp && c <= compDataBase)
    const indiceEhFocus = mensal === 'IPCA'
    const compIni = mesesProjetar[0]
    const compFim = mesesProjetar.at(-1)

    let projSeries = { series: {}, dataBoletim: dataBoletimFixada || null }
    const pedidosFocus = []
    if (indiceEhFocus) pedidosFocus.push({ serie: 'IPCA' })
    if (regimeUsaSelic) pedidosFocus.push({ serie: 'SELIC' })
    if (pedidosFocus.length) {
      try {
        projSeries = await resolverProjecaoImpl({
          pedidos: pedidosFocus, competenciaInicioISO: compIni, competenciaFimISO: compFim,
          cachePortFocus: cachePortFocus || criarCachePortFocus(supabase), fetchImpl, dataBoletimFixada,
        })
      } catch {
        throw erro(
          'Projeção do Focus indisponível no momento. Tente novamente em alguns minutos ou informe a projeção manualmente.',
          503,
        )
      }
    }
    const manualPorComp = Object.fromEntries((projecoesManuais || []).map((m) => [m.competencia, m]))

    for (const c of mesesProjetar) {
      if (indiceEhFocus) {
        const v = projSeries.series?.IPCA?.[c]
        if (v == null) throw erro(`Projeção do Focus indisponível para ${brMes(c)}.`, 422)
        serieMensal[c] = v
      } else {
        const m = manualPorComp[c]
        if (!m || typeof m.taxa !== 'number') throw erro(`Informe a projeção de ${mensal} para ${brMes(c)}.`, 422)
        serieMensal[c] = m.taxa
      }
    }
    series[mensal] = serieMensal

    if (regimeUsaSelic) {
      for (const c of mesesProjetar) {
        const metaAA = projSeries.series?.SELIC?.[c]
        if (metaAA == null) throw erro(`Projeção da SELIC (Focus) indisponível para ${brMes(c)}.`, 422)
        Object.assign(selic, sintetizarSelicDiariaProjetada(c, metaAA))
      }
      series.SELIC_DIARIA = selic
    }

    projecaoInfo = {
      ligada: true,
      dataBoletimFocus: projSeries.dataBoletim || null,
      projecoesManuais: projecoesManuais || [],
      mesesProjetados: mesesProjetar,
    }
  }

  // cobertura mensal (competências firmes, até a última competência disponível)
  const todosOsMeses = mesesEntre(inicioISO, fimISO)
  const meses = todosOsMeses.filter((c) => c <= ultimaComp)
  for (const c of meses) {
    if (serieMensal[c] == null) throw erro(`Índice ${mensal} indisponível para ${brMes(c)}. Tente novamente em alguns minutos.`, 503)
  }
  // SELIC: todo mês-calendário que [inicioISO, dataBase) toca precisa de ≥ 1 dia na série
  // (meses projetados só entram quando o regime usa SELIC — aí já foram sintetizados)
  const diasSelic = Object.keys(selic)
  const mesesSelic = mesesEntre(inicioISO, fimISO).filter((c) => c < fimISO && (regimeUsaSelic || c <= ultimaComp))
  for (const c of mesesSelic) {
    if (!diasSelic.some((d) => d.slice(0, 7) === c.slice(0, 7))) {
      throw erro(`Índice SELIC indisponível para ${brMes(c)}. Tente novamente em alguns minutos.`, 503)
    }
  }

  const argsMemoria = {
    parcelas: (parcelas || []).map((x) => ({
      id: x.id, competencia: x.competencia, vencimento: x.vencimento,
      valorDevido: Number(x.valor_devido), ativa: x.ativa === true,
    })),
    pagamentos: (pagamentos || []).map((x) => ({
      id: x.id, dataPagamento: x.data_pagamento, valor: Number(x.valor),
      identificadoPara: x.identificado_para || null,
    })),
    dataBase, dataCitacao: caso.data_citacao || null,
    indiceCorrecao: p.indice_correcao, regraImputacao: p.regra_imputacao,
    regimeJurosConvencionado: p.regime_juros_convencionado, series,
  }

  const memoria = calcularMemoria(argsMemoria)

  let saldoAteUltimoIndiceFirme = memoria.totais.saldo
  if (projecaoInfo) {
    const ultimoDiaFirme = new Date(Date.UTC(
      Number(ultimaComp.slice(0, 4)), Number(ultimaComp.slice(5, 7)), 0,
    )).toISOString().slice(0, 10)
    const memFirme = calcularMemoria({ ...argsMemoria, dataBase: ultimoDiaFirme })
    saldoAteUltimoIndiceFirme = memFirme.totais.saldo
    for (const l of memoria.linhas) {
      l.projetado = compDataBase > ultimaComp
      l.fonteProjecao = l.projetado
        ? (mensal === 'IPCA' ? `Focus de ${projecaoInfo.dataBoletimFocus}` : 'informado pelo advogado')
        : null
    }
  } else {
    for (const l of memoria.linhas) { l.projetado = false; l.fonteProjecao = null }
  }

  const { data: ultima } = await supabase
    .from('pensao_memoria').select('versao').eq('caso_id', casoId).order('versao', { ascending: false }).limit(1).maybeSingle()
  const versao = (ultima?.versao || 0) + 1

  const totais = projecaoInfo
    ? {
        ...memoria.totais,
        saldoAteUltimoIndiceFirme: arredonda2(saldoAteUltimoIndiceFirme),
        saldoComProjecao: memoria.totais.saldo,
      }
    : memoria.totais

  const { data: inserida, error: errIns } = await supabase.from('pensao_memoria').insert({
    caso_id: casoId, versao, data_base: dataBase,
    parametros_snapshot: {
      parametros: p, parcelas, pagamentos,
      projecao: projecaoInfo ? { ...projecaoInfo, nota: p.projecao_nota || null } : { ligada: false },
    },
    series_snapshot: series, linhas: memoria.linhas, totais, alertas: memoria.alertas,
  }).select('id').single()
  if (errIns) throw erro(`Falha ao gravar a memória: ${errIns.message}`, 500)

  return { memoriaId: inserida.id, versao }
}

export async function POST(request) {
  try {
    const { supabase } = clienteDoRequest(request)
    const { casoId, dataBase, permitirProjecao, projecoesManuais, dataBoletimFixada } = await request.json()
    const out = await processarCalculo({
      supabase, casoId, dataBase, cachePort: criarCachePort(supabase), fetchImpl: fetch,
      permitirProjecao: permitirProjecao === true, projecoesManuais: projecoesManuais || [],
      cachePortFocus: criarCachePortFocus(supabase), dataBoletimFixada: dataBoletimFixada || undefined,
    })
    return json(out, 201)
  } catch (e) {
    return json({ erro: e.message }, e.status || 500)
  }
}
