// api/pensao/_motor-pensao.js
//
// Motor de Execução de Pensão Alimentícia. REGRA + ARITMÉTICA PURAS:
// sem rede, sem IA, sem relógio (nada de Date.now / new Date() sem argumento),
// sem aleatoriedade. Recebe as séries de índice já resolvidas. Mesmo input =>
// mesma saída, byte a byte.

export const FRONTEIRA_LEI = '2024-08-30' // 1º dia do regime pós-Lei 14.905/2024

/** 2 casas decimais, meio para cima, robusto a artefato de ponto flutuante. */
export function arredonda2(n) {
  // normaliza para 3 casas (toFixed arredonda o double real corretamente),
  // depois decide o centavo pelo milésimo em aritmética inteira.
  const milesimos = Math.round(Number(n.toFixed(3)) * 1000)
  const resto = ((milesimos % 10) + 10) % 10
  const base = milesimos - (milesimos % 10)
  return (resto >= 5 ? base + 10 : base) / 1000
}

function ms(iso) {
  return Date.parse(`${iso}T00:00:00Z`) // ISO com Z: determinístico, sem timezone
}

/** Dias corridos de aISO até bISO (inteiro; negativo se b < a). */
export function diasCorridos(aISO, bISO) {
  return Math.round((ms(bISO) - ms(aISO)) / 86400000)
}

/** Dias do mês de uma competência 'YYYY-MM-01'. */
export function diasNoMes(competenciaISO) {
  const [ano, mes] = competenciaISO.split('-').map(Number)
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate()
}

/**
 * Quebra [vencISO, dataBaseISO] em 1 ou 2 trechos na FRONTEIRA_LEI.
 * @returns {Array<{ini:string,fim:string,regime:'pre'|'pos'}>}
 */
export function partesTrecho(vencISO, dataBaseISO) {
  if (dataBaseISO <= vencISO) return []
  if (dataBaseISO <= FRONTEIRA_LEI) {
    return [{ ini: vencISO, fim: dataBaseISO, regime: 'pre' }]
  }
  if (vencISO >= FRONTEIRA_LEI) {
    return [{ ini: vencISO, fim: dataBaseISO, regime: 'pos' }]
  }
  return [
    { ini: vencISO, fim: FRONTEIRA_LEI, regime: 'pre' },
    { ini: FRONTEIRA_LEI, fim: dataBaseISO, regime: 'pos' },
  ]
}

/**
 * Produto dos fatores diários da SELIC em [iniISO, fimISO).
 * @throws se diasCorridos(ini,fim) > 0 e nenhuma data da série cai no intervalo.
 */
export function fatorSelic(serieDiaria, iniISO, fimISO) {
  if (iniISO === fimISO) return 1
  let fator = 1
  let contou = 0
  // ordena as chaves: jsonb (series_snapshot) não preserva ordem de inserção,
  // e multiplicação de float não é associativa — sem isso, recalcular a
  // partir do snapshot poderia dar um resultado ligeiramente diferente.
  for (const d of Object.keys(serieDiaria).sort()) {
    if (d >= iniISO && d < fimISO) {
      fator *= 1 + serieDiaria[d] / 100
      contou += 1
    }
  }
  if (contou === 0 && diasCorridos(iniISO, fimISO) > 0) {
    throw new Error(`SELIC sem dados no intervalo ${iniISO}..${fimISO}`)
  }
  return fator
}

/** 1º dia do mês de uma data ISO. */
function competenciaDe(iso) {
  return `${iso.slice(0, 7)}-01`
}

/** Avança uma competência 'YYYY-MM-01' em 1 mês. */
function proximaCompetencia(compISO) {
  let [ano, mes] = compISO.split('-').map(Number)
  mes += 1
  if (mes > 12) { mes = 1; ano += 1 }
  return `${ano}-${String(mes).padStart(2, '0')}-01`
}

/**
 * Acumula um índice mensal em [iniISO, fimISO) com pró-rata die nas pontas.
 * @throws se faltar a competência de qualquer mês tocado.
 */
export function fatorMensal(serieMensal, iniISO, fimISO) {
  if (iniISO === fimISO) return 1
  let fator = 1
  let comp = competenciaDe(iniISO)
  const compFim = competenciaDe(fimISO) // mês onde termina (exclusivo no dia, mas o mês pode ser tocado)
  // percorre cada competência de comp até (e incluindo) o mês de fimISO, enquanto houver dias no trecho
  while (comp <= compFim) {
    const inicioMes = comp
    const fimMes = proximaCompetencia(comp)
    const a = iniISO > inicioMes ? iniISO : inicioMes
    const b = fimISO < fimMes ? fimISO : fimMes
    const dias = diasCorridos(a, b)
    if (dias > 0) {
      const m = serieMensal[comp]
      if (m == null) throw new Error(`índice mensal ausente para a competência ${comp}`)
      const dim = diasNoMes(comp)
      fator *= dias >= dim ? 1 + m / 100 : 1 + (m / 100) * (dias / dim)
    }
    comp = fimMes
  }
  return fator
}

export const SERIE_DE_INDICE = { INPC: 'INPC', IGPM: 'IGPM', 'IPCA-E': 'IPCA15', IPCA: 'IPCA' }

const FUND_PRE = ['STJ, REsp 1.795.982/SP (Corte Especial)', 'CC, art. 397']
const FUND_POS = ['Lei 14.905/2024 (arts. 389 e 406 do CC)', 'CC, art. 397']
const FUND_CONV = ['título executivo', 'CC, art. 397']

function brData(iso) {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

function dedup(arr) {
  const visto = new Set()
  const out = []
  for (const x of arr) if (!visto.has(x)) { visto.add(x); out.push(x) }
  return out
}

function ordenarPagamentos(pgs) {
  return [...pgs].sort((a, b) =>
    a.dataPagamento < b.dataPagamento ? -1 : a.dataPagamento > b.dataPagamento ? 1
      : a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}

export function distribuirPagamentos({ parcelasAtivas, pagamentos, regraImputacao }) {
  const abertoNominal = new Map(parcelasAtivas.map((p) => [p.id, p.valorDevido]))
  const dest = {}
  const push = (pid, pagamentoId, data, valor) => {
    if (valor <= 0) return
    ;(dest[pid] ||= []).push({ pagamentoId, data, valor })
  }
  const porId = new Map(parcelasAtivas.map((p) => [p.id, p]))

  const ordemAntigas = [...parcelasAtivas].sort((a, b) =>
    a.vencimento < b.vencimento ? -1 : a.vencimento > b.vencimento ? 1
      : a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  const ordemRecentes = [...ordemAntigas].reverse()

  for (const pg of ordenarPagamentos(pagamentos)) {
    let restante = pg.valor

    if (pg.identificadoPara && porId.has(pg.identificadoPara)) {
      const cap = abertoNominal.get(pg.identificadoPara)
      const usa = Math.min(restante, cap)
      push(pg.identificadoPara, pg.id, pg.dataPagamento, usa)
      abertoNominal.set(pg.identificadoPara, cap - usa)
      restante -= usa
    }
    if (restante <= 0) continue

    if (regraImputacao === 'pro_rata') {
      const abertas = ordemAntigas.filter((p) => abertoNominal.get(p.id) > 0)
      const somaAberto = abertas.reduce((s, p) => s + abertoNominal.get(p.id), 0)
      if (somaAberto <= 0) { push('__excedente__', pg.id, pg.dataPagamento, restante); continue }
      let distribuido = 0
      abertas.forEach((p, i) => {
        const quota = i === abertas.length - 1
          ? restante - distribuido
          : restante * (abertoNominal.get(p.id) / somaAberto)
        const usa = Math.min(quota, abertoNominal.get(p.id))
        push(p.id, pg.id, pg.dataPagamento, usa)
        abertoNominal.set(p.id, abertoNominal.get(p.id) - usa)
        distribuido += usa
      })
      const sobra = restante - distribuido
      if (sobra > 1e-9) push('__excedente__', pg.id, pg.dataPagamento, sobra)
      continue
    }

    const ordem = regraImputacao === 'mais_recentes_primeiro' ? ordemRecentes : ordemAntigas
    for (const p of ordem) {
      if (restante <= 0) break
      const cap = abertoNominal.get(p.id)
      if (cap <= 0) continue
      const usa = Math.min(restante, cap)
      push(p.id, pg.id, pg.dataPagamento, usa)
      abertoNominal.set(p.id, cap - usa)
      restante -= usa
    }
    if (restante > 1e-9) push('__excedente__', pg.id, pg.dataPagamento, restante)
  }
  return dest
}

export function calcularLinhaParcela({
  // dataCitacao não é usada aqui (o filtro/alerta de citação é aplicado em
  // calcularMemoria); mantido no destructuring para casar a assinatura com o
  // resto do código-base que chama esta função com esse nome de parâmetro.
  // eslint-disable-next-line no-unused-vars
  parcela, abatimentos, dataBase, dataCitacao, indiceCorrecao, regimeJuros, series,
}) {
  const venc = parcela.vencimento
  // datas de corte: as dos abatimentos, "grampeadas" em [venc, dataBase], ordenadas e únicas
  const cortes = [...new Set(
    abatimentos.map((a) => (a.data < venc ? venc : a.data > dataBase ? dataBase : a.data)),
  )].sort()
  const marcos = [venc, ...cortes.filter((d) => d > venc && d < dataBase), dataBase]

  let montante = parcela.valorDevido
  let corrAcc = 0
  let jurosAcc = 0
  const criteriosC = []
  const criteriosJ = []
  const funds = []
  const pagamentosAbatidos = []

  // abatimentos com data <= venc: aplicados ANTES de qualquer acréscimo (no
  // próprio venc, marco 0) — senão o pagamento pontual/antecipado acabaria
  // sendo descontado só DEPOIS de acrescido o período inteiro até dataBase.
  for (const ab of abatimentos) {
    const d = ab.data < venc ? venc : ab.data > dataBase ? dataBase : ab.data
    if (d === venc) {
      const usa = Math.min(montante, ab.valor)
      montante -= usa
      const fwd = atualizarIntervalo({ principal: ab.valor, ini: venc, fim: dataBase, indiceCorrecao, regimeJuros, series })
      pagamentosAbatidos.push({
        pagamentoId: ab.pagamentoId, data: ab.data,
        valorPago: arredonda2(ab.valor),
        valorNaDataBase: arredonda2(ab.valor + fwd.correcao + fwd.juros),
      })
    }
  }

  for (let i = 0; i < marcos.length - 1; i++) {
    const a = marcos[i]
    const b = marcos[i + 1]
    if (b > a) {
      const r = atualizarIntervalo({ principal: montante, ini: a, fim: b, indiceCorrecao, regimeJuros, series })
      corrAcc += r.correcao
      jurosAcc += r.juros
      montante += r.correcao + r.juros
      if (r.criterioCorrecao !== '—') criteriosC.push(r.criterioCorrecao)
      if (r.criterioJuros !== '—') criteriosJ.push(r.criterioJuros)
      funds.push(...r.fundamentos)
      // abatimentos cuja data (grampeada) == b (nunca === venc, tratados acima)
      for (const ab of abatimentos) {
        const d = ab.data < venc ? venc : ab.data > dataBase ? dataBase : ab.data
        if (d === b) {
          const usa = Math.min(montante, ab.valor)
          montante -= usa
          const fwd = atualizarIntervalo({ principal: ab.valor, ini: d, fim: dataBase, indiceCorrecao, regimeJuros, series })
          pagamentosAbatidos.push({
            pagamentoId: ab.pagamentoId,
            data: ab.data,
            valorPago: arredonda2(ab.valor),
            valorNaDataBase: arredonda2(ab.valor + fwd.correcao + fwd.juros),
          })
        }
      }
    }
  }

  return {
    parcelaId: parcela.id,
    competencia: parcela.competencia.slice(0, 7),
    vencimento: parcela.vencimento,
    valorDevidoOriginal: arredonda2(parcela.valorDevido),
    correcao: {
      valor: arredonda2(corrAcc),
      fator: Number((1 + corrAcc / (parcela.valorDevido || 1)).toFixed(6)),
      criterio: criteriosC.join(' + ') || '—',
    },
    juros: { valor: arredonda2(jurosAcc), criterio: criteriosJ.join(' + ') || '—' },
    pagamentosAbatidos,
    saldoAtualizado: arredonda2(montante),
    fundamentos: dedup(funds),
  }
}

/**
 * Atualiza `principal` de ini até fim (exclusivo). Ver Interfaces da Task 5.
 * Não arredonda.
 */
export function atualizarIntervalo({ principal, ini, fim, indiceCorrecao, regimeJuros, series }) {
  if (fim <= ini) {
    return { correcao: 0, juros: 0, criterioCorrecao: '—', criterioJuros: '—', fundamentos: [] }
  }

  if (indiceCorrecao === 'legal') {
    let montante = principal
    let correcaoTotal = 0
    let jurosTotal = 0
    const criteriosC = []
    const criteriosJ = []
    const funds = []
    for (const p of partesTrecho(ini, fim)) {
      if (p.regime === 'pre') {
        const fs = fatorSelic(series.SELIC_DIARIA, p.ini, p.fim)
        const acr = montante * (fs - 1)
        jurosTotal += acr
        montante += acr
        criteriosJ.push(`SELIC isolada de ${brData(p.ini)} a ${brData(p.fim)} (STJ, REsp 1.795.982/SP)`)
        funds.push(...FUND_PRE)
      } else {
        const fi = fatorMensal(series.IPCA, p.ini, p.fim)
        const corr = montante * (fi - 1)
        correcaoTotal += corr
        montante += corr
        const fsel = fatorSelic(series.SELIC_DIARIA, p.ini, p.fim)
        const jur = montante * Math.max(0, fsel - fi)
        jurosTotal += jur
        montante += jur
        criteriosC.push(`IPCA de ${brData(p.ini)} a ${brData(p.fim)}, pró-rata die`)
        criteriosJ.push(`SELIC menos IPCA no período (Lei 14.905/2024, art. 406 do CC)`)
        funds.push(...FUND_POS)
      }
    }
    return {
      correcao: correcaoTotal,
      juros: jurosTotal,
      criterioCorrecao: criteriosC.join(' + ') || '—',
      criterioJuros: criteriosJ.join(' + ') || '—',
      fundamentos: dedup(funds),
    }
  }

  // convencionado
  const chave = SERIE_DE_INDICE[indiceCorrecao]
  if (!chave) throw new Error(`indiceCorrecao inválido: ${indiceCorrecao}`)
  const fconv = fatorMensal(series[chave], ini, fim)
  const correcao = principal * (fconv - 1)
  const corrigido = principal + correcao
  const dias = diasCorridos(ini, fim)
  let juros
  let critJ
  if (regimeJuros === '1_am_simples') {
    juros = corrigido * 0.01 * (dias / 30)
    critJ = 'juros de mora de 1% ao mês, simples, pró-rata die'
  } else if (regimeJuros === '1_am_capitalizado') {
    juros = corrigido * (1.01 ** (dias / 30) - 1)
    critJ = 'juros de mora de 1% ao mês, capitalizados, pró-rata die'
  } else if (regimeJuros === 'selic') {
    juros = corrigido * (fatorSelic(series.SELIC_DIARIA, ini, fim) - 1)
    critJ = 'juros pela SELIC no período'
  } else {
    throw new Error(`regimeJuros inválido: ${regimeJuros}`)
  }
  return {
    correcao,
    juros,
    criterioCorrecao: `${indiceCorrecao} de ${brData(ini)} a ${brData(fim)}, pró-rata die (índice convencionado no título)`,
    criterioJuros: critJ,
    fundamentos: dedup(FUND_CONV),
  }
}

export function calcularMemoria({
  parcelas, pagamentos, dataBase, dataCitacao,
  indiceCorrecao, regraImputacao, regimeJurosConvencionado, series,
}) {
  const ativas = parcelas
    .filter((p) => p.ativa === true)
    .sort((a, b) =>
      a.vencimento < b.vencimento ? -1 : a.vencimento > b.vencimento ? 1
        : a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

  const regimeJuros = indiceCorrecao === 'legal' ? '1_am_simples' : regimeJurosConvencionado

  const dist = distribuirPagamentos({
    parcelasAtivas: ativas.map((p) => ({ id: p.id, vencimento: p.vencimento, valorDevido: p.valorDevido })),
    pagamentos,
    regraImputacao,
  })

  const abatimentosPorParcela = new Map(ativas.map((p) => {
    const abat = [...(dist[p.id] || [])].sort((a, b) =>
      a.data < b.data ? -1 : a.data > b.data ? 1
        : a.pagamentoId < b.pagamentoId ? -1 : a.pagamentoId > b.pagamentoId ? 1 : 0)
    return [p.id, abat]
  }))

  const linhas = ativas.map((p) => calcularLinhaParcela({
    parcela: { id: p.id, competencia: p.competencia, vencimento: p.vencimento, valorDevido: p.valorDevido },
    abatimentos: abatimentosPorParcela.get(p.id),
    dataBase, dataCitacao, indiceCorrecao, regimeJuros, series,
  }))

  // Excedente (pagamentos além do valor nominal de todas as parcelas) não
  // pode ser descartado enquanto houver saldo residual (juros/correção não
  // cobertos pelo abatimento nominal) em alguma parcela ativa — o devedor já
  // entregou o dinheiro; falta só decidir contra qual saldo residual aplicar.
  // distribuirPagamentos só cria __excedente__ depois que TODAS as parcelas
  // já receberam seu abatimento nominal cheio, então aqui é só cobrir o que
  // sobrou de juros/correção com o que sobrou de dinheiro. Ordem: mesma regra
  // de regraImputacao (pro_rata usa a ordem de vencimento como simplificação
  // — o rateio proporcional já aconteceu na 1ª rodada, o resíduo é pequeno).
  const excedenteBruto = dist.__excedente__ || []
  let excedenteResidual = 0
  if (excedenteBruto.length) {
    const pool = excedenteBruto.map((e) => ({ ...e }))
    const ordemResidual = regraImputacao === 'mais_recentes_primeiro' ? [...ativas].reverse() : ativas

    for (const p of ordemResidual) {
      const idx = linhas.findIndex((l) => l.parcelaId === p.id)
      if (idx === -1 || linhas[idx].saldoAtualizado <= 0) continue
      // `saldoAtualizado` está valorado EM dataBase. O excedente é dinheiro
      // parado na data do próprio pagamento (exc.data), quase sempre anterior
      // a dataBase — descontamos o residual pra "quanto isso vale na data do
      // excedente" antes de comparar, senão sub/sobre-corrigimos o quanto
      // realmente falta (esse dinheiro ainda vai render entre exc.data e
      // dataBase, exatamente como um abatimento comum).
      let faltaNaDataBase = linhas[idx].saldoAtualizado
      const extras = []
      for (const exc of pool) {
        if (faltaNaDataBase <= 1e-9) break
        if (exc.valor <= 0) continue
        const fwd = atualizarIntervalo({ principal: 1, ini: exc.data, fim: dataBase, indiceCorrecao, regimeJuros, series })
        const fatorFwd = 1 + fwd.correcao + fwd.juros
        const faltaNaDataDoExcedente = faltaNaDataBase / fatorFwd
        const usa = Math.min(faltaNaDataDoExcedente, exc.valor)
        extras.push({ pagamentoId: exc.pagamentoId, data: exc.data, valor: usa })
        exc.valor -= usa
        faltaNaDataBase -= usa * fatorFwd
      }
      if (extras.length) {
        const abatCompletos = [...abatimentosPorParcela.get(p.id), ...extras].sort((a, b) =>
          a.data < b.data ? -1 : a.data > b.data ? 1
            : a.pagamentoId < b.pagamentoId ? -1 : a.pagamentoId > b.pagamentoId ? 1 : 0)
        linhas[idx] = calcularLinhaParcela({
          parcela: { id: p.id, competencia: p.competencia, vencimento: p.vencimento, valorDevido: p.valorDevido },
          abatimentos: abatCompletos,
          dataBase, dataCitacao, indiceCorrecao, regimeJuros, series,
        })
      }
    }
    // valorado em dataBase (é dinheiro que ficou parado desde exc.data) —
    // senão o alerta "na data-base" mostraria um valor de outra data.
    excedenteResidual = pool.reduce((s, e) => {
      if (e.valor <= 0) return s
      const fwd = atualizarIntervalo({ principal: e.valor, ini: e.data, fim: dataBase, indiceCorrecao, regimeJuros, series })
      return s + e.valor + fwd.correcao + fwd.juros
    }, 0)
  }

  const somaOriginal = arredonda2(linhas.reduce((s, l) => s + l.valorDevidoOriginal, 0))
  const somaCorrecao = arredonda2(linhas.reduce((s, l) => s + l.correcao.valor, 0))
  const somaJuros = arredonda2(linhas.reduce((s, l) => s + l.juros.valor, 0))
  const somaPagamentos = arredonda2(
    linhas.reduce((s, l) => s + l.pagamentosAbatidos.reduce((t, p) => t + p.valorPago, 0), 0),
  )
  const saldo = arredonda2(linhas.reduce((s, l) => s + l.saldoAtualizado, 0))

  const alertas = []
  if (dataCitacao) {
    for (const p of ativas) {
      if (p.vencimento < dataCitacao) {
        alertas.push(
          `Parcela ${p.competencia.slice(0, 7)} vence antes da citação (${brData(dataCitacao)}); ` +
          `confira a exigibilidade neste feito (Lei 5.478/68, art. 13, §2º).`,
        )
      }
    }
  }
  if (excedenteResidual > 1e-9) {
    alertas.push(`Os pagamentos superam o débito atualizado em R$ ${arredonda2(excedenteResidual)} na data-base.`)
  }

  return {
    linhas,
    totais: { somaOriginal, somaCorrecao, somaJuros, somaPagamentos, saldo },
    alertas,
  }
}
