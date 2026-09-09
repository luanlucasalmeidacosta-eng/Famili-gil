// api/_core/tributos.js
//
// Aritmética tributária pura, compartilhada por api/partilha (motor) e pela
// UI da biblioteca (validação de faixas). Vive em _core/ pelo mesmo motivo
// de dinheiro.js: sem nada específico de Node, bundlável pelo Vite.

import { arredonda2 } from './dinheiro.js'

/**
 * @param {Array<{ate:number|null, aliquota:number}>} faixas
 * @returns {{ok:true} | {ok:false, motivo:string}}
 */
export function validarFaixasItcmd(faixas) {
  if (!Array.isArray(faixas) || faixas.length === 0) {
    return { ok: false, motivo: 'Informe ao menos uma faixa.' }
  }
  for (let i = 0; i < faixas.length; i++) {
    const f = faixas[i]
    if (typeof f.aliquota !== 'number' || Number.isNaN(f.aliquota) || f.aliquota < 0) {
      return { ok: false, motivo: `Faixa ${i + 1}: alíquota inválida.` }
    }
    const ehUltima = i === faixas.length - 1
    if (ehUltima) {
      if (f.ate !== null) return { ok: false, motivo: 'A última faixa deve ser aberta (sem teto).' }
    } else {
      if (f.ate === null) return { ok: false, motivo: `Faixa ${i + 1}: só a última faixa pode ser aberta.` }
      if (typeof f.ate !== 'number' || Number.isNaN(f.ate) || f.ate <= 0) {
        return { ok: false, motivo: `Faixa ${i + 1}: teto inválido.` }
      }
      const anteriorAte = i === 0 ? 0 : faixas[i - 1].ate
      if (f.ate <= anteriorAte) {
        return { ok: false, motivo: `Faixa ${i + 1}: o teto deve ser maior que o da faixa anterior.` }
      }
    }
  }
  return { ok: true }
}

/**
 * Normaliza as linhas do editor de faixas (form state, com strings vazias) para
 * o formato do domínio, unificando os dois editores (biblioteca e Cenários):
 *  - descarta linhas totalmente vazias (`ate === '' && aliquota === ''`);
 *  - teto vazio (`ate === ''`) vira faixa aberta (`ate: null`) — é assim que a
 *    última linha (que não tem campo de teto) chega aqui;
 *  - as demais recebem `Number(ate)`.
 * A validação de ordem/abertura fica a cargo de `validarFaixasItcmd`.
 * @param {Array<{ate:string|number|null, aliquota:string|number}>} linhas
 * @returns {Array<{ate:number|null, aliquota:number}>}
 */
export function montarFaixasItcmd(linhas) {
  return (linhas || [])
    .filter((x) => !(x.ate === '' && x.aliquota === ''))
    .map((x) => ({
      ate: x.ate === '' || x.ate === null ? null : Number(x.ate),
      aliquota: Number(x.aliquota),
    }))
}

/**
 * Valor do ITCMD sobre `base`, aplicando as faixas progressivas.
 * @param {number} base
 * @param {Array<{ate:number|null, aliquota:number}>} faixas — já validada
 * @returns {number}
 */
export function calcularValorItcmd(base, faixas) {
  const v = validarFaixasItcmd(faixas)
  if (!v.ok) throw new Error(`faixas de ITCMD inválidas: ${v.motivo}`)
  if (!(base > 0)) return 0
  let total = 0
  let piso = 0
  for (const f of faixas) {
    const teto = f.ate === null ? base : Math.min(base, f.ate)
    if (teto > piso) {
      total += arredonda2((teto - piso) * f.aliquota / 100)
      piso = teto
    }
    if (piso >= base) break
  }
  return arredonda2(total)
}
