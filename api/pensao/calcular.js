// api/pensao/calcular.js
import { clienteDoRequest, json } from '../_core/supabase.js'
import { SERIES, resolverSeries } from '../_core/indices-bcb.js'
import { criarCachePort } from '../_core/cache-indices.js'
import { calcularMemoria, SERIE_DE_INDICE } from './_motor-pensao.js'

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

export async function processarCalculo({ supabase, casoId, dataBase, resolver = resolverSeries, cachePort, fetchImpl }) {
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

  const series = await resolver({ pedidos, inicioISO, fimISO, cachePort, fetchImpl })

  // data-base não pode passar da última competência fechada
  const serieMensal = series[mensal] || {}
  const ultimaComp = Object.keys(serieMensal).sort().at(-1)
  if (comp(dataBase) > ultimaComp) {
    throw erro(`Índice fechado disponível apenas até ${brMes(ultimaComp)}. Ajuste a data-base.`, 422)
  }
  // cobertura mensal (apenas até a última competência disponível)
  const todosOsMeses = mesesEntre(inicioISO, fimISO)
  const meses = todosOsMeses.filter(c => c <= ultimaComp)
  for (const c of meses) {
    if (serieMensal[c] == null) throw erro(`Índice ${mensal} indisponível para ${brMes(c)}. Tente novamente em alguns minutos.`, 503)
  }
  // SELIC: cada mês do intervalo precisa de ≥ 1 dia
  const selic = series.SELIC_DIARIA || {}
  const diasSelic = Object.keys(selic)
  for (const c of meses.slice(0, -1).concat(comp(dataBase) === comp(inicioISO) ? [] : [comp(dataBase)])) {
    if (!diasSelic.some((d) => d.slice(0, 7) === c.slice(0, 7))) {
      throw erro(`Índice SELIC indisponível para ${brMes(c)}. Tente novamente em alguns minutos.`, 503)
    }
  }

  const memoria = calcularMemoria({
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
  })

  const { data: ultima } = await supabase
    .from('pensao_memoria').select('versao').eq('caso_id', casoId).order('versao', { ascending: false }).limit(1).maybeSingle()
  const versao = (ultima?.versao || 0) + 1

  const { data: inserida, error: errIns } = await supabase.from('pensao_memoria').insert({
    caso_id: casoId, versao, data_base: dataBase,
    parametros_snapshot: { parametros: p, parcelas, pagamentos },
    series_snapshot: series, linhas: memoria.linhas, totais: memoria.totais, alertas: memoria.alertas,
  }).select('id').single()
  if (errIns) throw erro(`Falha ao gravar a memória: ${errIns.message}`, 500)

  return { memoriaId: inserida.id, versao }
}

export async function POST(request) {
  try {
    const { supabase } = clienteDoRequest(request)
    const { casoId, dataBase } = await request.json()
    const out = await processarCalculo({ supabase, casoId, dataBase, cachePort: criarCachePort(supabase), fetchImpl: fetch })
    return json(out, 201)
  } catch (e) {
    return json({ erro: e.message }, e.status || 500)
  }
}
