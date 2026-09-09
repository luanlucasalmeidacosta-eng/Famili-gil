// Reexport para o cliente (Vite) das funções puras de tributos de _core/.
// Single source of truth: api/_core/tributos.js. Mesmo padrão de classificar.js.
export { validarFaixasItcmd, calcularValorItcmd, montarFaixasItcmd } from '../../../api/_core/tributos.js'
