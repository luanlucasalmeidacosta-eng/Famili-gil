import AbaParametros from '../features/pensao/AbaParametros.jsx'
import AbaParcelas from '../features/pensao/AbaParcelas.jsx'
import AbaPagamentos from '../features/pensao/AbaPagamentos.jsx'
import AbaDocumentos from '../features/AbaDocumentos.jsx'
import AbaMemoria from '../features/pensao/AbaMemoria.jsx'
import CasoShell from '../components/CasoShell.jsx'

const ABAS = [
  ['parametros', 'Parâmetros', AbaParametros],
  ['parcelas', 'Parcelas', AbaParcelas],
  ['pagamentos', 'Pagamentos', AbaPagamentos],
  ['documentos', 'Documentos', AbaDocumentos],
  ['memoria', 'Memória de cálculo', AbaMemoria],
]

export default function CasoPensao({ caso }) {
  return <CasoShell caso={caso} subtitulo="Execução de pensão alimentícia" abas={ABAS} abaInicial="parametros" />
}
