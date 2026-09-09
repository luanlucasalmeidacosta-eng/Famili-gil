// Sondagem da API Olinda de Expectativas de Mercado do BCB.
// Objetivo: confirmar endpoint mensal, nomes de campo e filtros.
// Rodar: node scripts/spike-focus.mjs
const BASE = 'https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata'

async function get(url) {
  const r = await fetch(url)
  console.log(url, '→', r.status)
  if (!r.ok) return null
  const j = await r.json()
  console.log('  keys:', Object.keys(j))
  console.log('  amostra[0]:', JSON.stringify((j.value || [])[0], null, 2))
  return j
}

// candidatos de endpoint mensal
await get(`${BASE}/ExpectativaMercadoMensais?$top=3&$format=json&$filter=Indicador eq 'IPCA'&$orderby=Data desc`)
await get(`${BASE}/ExpectativasMercadoMensais?$top=3&$format=json&$filter=Indicador eq 'IPCA'&$orderby=Data desc`)
await get(`${BASE}/ExpectativaMercadoMensais?$top=3&$format=json&$filter=Indicador eq 'Selic'&$orderby=Data desc`)
