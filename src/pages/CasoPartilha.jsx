import AbaRegimeMarcos from '../features/partilha/AbaRegimeMarcos.jsx'
import AbaBens from '../features/partilha/AbaBens.jsx'
import AbaPassivos from '../features/partilha/AbaPassivos.jsx'
import AbaCenarios from '../features/partilha/AbaCenarios.jsx'
import AbaDocumentos from '../features/AbaDocumentos.jsx'
import AbaMemoria from '../features/partilha/AbaMemoria.jsx'
import CasoShell from '../components/CasoShell.jsx'

const ABAS = [
  ['regime', 'Regime e marcos', AbaRegimeMarcos],
  ['bens', 'Bens', AbaBens],
  ['passivos', 'Passivos', AbaPassivos],
  ['cenarios', 'Cenários', AbaCenarios],
  ['documentos', 'Documentos', AbaDocumentos],
  ['memoria', 'Memória de partilha', AbaMemoria],
]

export default function CasoPartilha({ caso }) {
  return <CasoShell caso={caso} subtitulo="Partilha de bens" abas={ABAS} abaInicial="regime" />
}
