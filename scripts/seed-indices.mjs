#!/usr/bin/env node
// scripts/seed-indices.mjs
//
// Pré-carrega o cache `indices_cache` do Supabase com o histórico das séries
// do SGS, janelado em 10 anos. Roda LOCALMENTE, com a service_role key
// (bypassa RLS). NUNCA na Vercel.
//
// Uso:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-indices.mjs 1996-01-01 2026-08-31
//
import { createClient } from '@supabase/supabase-js'
import { SERIES, buscarSerieNoSgs } from '../api/_core/indices-bcb.js'

const [, , inicioISO = '1996-01-01', fimISO = new Date().toISOString().slice(0, 10)] = process.argv
const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('faltam SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }

const sb = createClient(url, key)
const PEDIDOS = [
  { chave: 'SELIC_DIARIA', codigo: SERIES.SELIC_DIARIA, tipoRef: 'dia' },
  { chave: 'IPCA', codigo: SERIES.IPCA, tipoRef: 'mes' },
  { chave: 'INPC', codigo: SERIES.INPC, tipoRef: 'mes' },
  { chave: 'IGPM', codigo: SERIES.IGPM, tipoRef: 'mes' },
  { chave: 'IPCA15', codigo: SERIES.IPCA15, tipoRef: 'mes' },
]

for (const { chave, codigo, tipoRef } of PEDIDOS) {
  process.stdout.write(`Buscando ${chave}... `)
  const dados = await buscarSerieNoSgs({ codigo, tipoRef, inicioISO, fimISO, fetchImpl: fetch })
  const linhas = dados.map(({ ref, valor }) => ({ serie: chave, ref, valor, buscado_em: new Date().toISOString() }))
  const { error } = await sb.from('indices_cache').upsert(linhas, { onConflict: 'serie,ref' })
  if (error) { console.error(`\nERRO ao gravar ${chave}:`, error.message); process.exit(1) }
  console.log(`${linhas.length} pontos.`)
}
console.log('Seed concluído.')
