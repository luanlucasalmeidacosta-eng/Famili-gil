// api/_core/dinheiro.js
//
// Utilitário de dinheiro compartilhado por api/pensao e api/partilha.
// Vive em _core/ (não em pensao/ nem partilha/) porque nenhuma das duas fases
// pode depender da outra (inviolável 9) — mas ambas precisam da MESMA regra
// de arredondamento, senão memórias das duas fases divergiriam sem motivo.

/** 2 casas decimais, meio para cima, robusto a artefato de ponto flutuante. */
export function arredonda2(n) {
  // normaliza para 3 casas (toFixed arredonda o double real corretamente),
  // depois decide o centavo pelo milésimo em aritmética inteira.
  const milesimos = Math.round(Number(n.toFixed(3)) * 1000)
  const resto = ((milesimos % 10) + 10) % 10
  const base = milesimos - (milesimos % 10)
  return (resto >= 5 ? base + 10 : base) / 1000
}
