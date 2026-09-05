// src/features/partilha/classificar.js
//
// Preview de classificação no cliente. Reexporta a MESMA função usada no
// servidor (api/partilha/_motor-partilha.js) — fonte única de verdade, pra
// nunca divergir entre o que o advogado vê ao cadastrar um bem e o que a
// rota /api/partilha/calcular grava na memória oficial.
export { classificarBem } from '../../../api/partilha/_motor-partilha.js'
