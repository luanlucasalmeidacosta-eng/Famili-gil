// api/partilha/calcular.js
import { clienteDoRequest, json } from '../_core/supabase.js'
import { calcularPartilha } from './_motor-partilha.js'

const erro = (msg, status) => Object.assign(new Error(msg), { status })

export async function processarCalculo({ supabase, casoId, cenarioId }) {
  const { data: caso } = await supabase.from('casos').select('*').eq('id', casoId).maybeSingle()
  if (!caso) throw erro('Caso não encontrado.', 404)

  const { data: config } = await supabase.from('partilha_config').select('*').eq('caso_id', casoId).maybeSingle()
  if (!config) throw erro('Defina o regime de bens e os marcos antes de calcular.', 422)

  const { data: bens } = await supabase.from('partilha_bens').select('*').eq('caso_id', casoId)
  const { data: passivos } = await supabase.from('partilha_passivos').select('*').eq('caso_id', casoId)
  const { data: cenario } = await supabase
    .from('partilha_cenarios').select('*').eq('id', cenarioId).eq('caso_id', casoId).maybeSingle()
  if (!cenario) throw erro('Cenário não encontrado.', 404)

  const marcos = {
    dataCasamento: config.data_casamento,
    dataSeparacaoFato: config.data_separacao_fato || null,
    separacaoFatoEfeito: config.separacao_fato_efeito,
    dataAjuizamento: config.data_ajuizamento || null,
  }
  const bensMapeados = (bens || []).map((b) => ({
    id: b.id, descricao: b.descricao, tipo: b.tipo, valorMercado: Number(b.valor_mercado),
    dataAquisicao: b.data_aquisicao || null, formaAquisicao: b.forma_aquisicao || null,
    clausulaIncomunicabilidade: b.clausula_incomunicabilidade === true, titular: b.titular,
    financiado: b.financiado === true, saldoDevedor: b.saldo_devedor != null ? Number(b.saldo_devedor) : null,
    classificacaoOverride: b.classificacao_override || null,
  }))
  const passivosMapeados = (passivos || []).map((p) => ({
    id: p.id, valor: Number(p.valor), natureza: p.natureza, responsavel: p.responsavel,
    bemVinculadoId: p.bem_vinculado_id || null,
  }))
  const cenarioMapeado = {
    pctParteA: Number(cenario.pct_parte_a), alocacoes: cenario.alocacoes || [], tornas: cenario.tornas || [],
  }

  const memoria = calcularPartilha({
    regimeBens: config.regime_bens, marcos, bens: bensMapeados, passivos: passivosMapeados, cenario: cenarioMapeado,
  })

  const { data: ultima } = await supabase
    .from('partilha_memoria').select('versao').eq('caso_id', casoId).order('versao', { ascending: false }).limit(1).maybeSingle()
  const versao = (ultima?.versao || 0) + 1

  const { data: inserida, error: errIns } = await supabase.from('partilha_memoria').insert({
    caso_id: casoId, cenario_id: cenarioId, versao,
    entradas_snapshot: { config, bens, passivos, cenario },
    linhas_bens: memoria.linhasBens, quadro_quinhoes: memoria.quadroQuinhoes,
    linha_tempo: memoria.linhaTempo, alertas_tributarios: memoria.alertasTributarios,
    totais: memoria.totais, alertas: memoria.alertas,
  }).select('id').single()
  if (errIns) throw erro(`Falha ao gravar a memória: ${errIns.message}`, 500)

  return { memoriaId: inserida.id, versao }
}

export async function POST(request) {
  try {
    const { supabase } = clienteDoRequest(request)
    const { casoId, cenarioId } = await request.json()
    const out = await processarCalculo({ supabase, casoId, cenarioId })
    return json(out, 201)
  } catch (e) {
    return json({ erro: e.message }, e.status || 500)
  }
}
