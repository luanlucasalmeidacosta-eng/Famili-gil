# Banco (Supabase)

Projeto Supabase **próprio do FamiliÁgil** — nunca o do TributÁgil.

## Aplicar as migrations

Sem CLI: cole o conteúdo de cada arquivo `migrations/NNNN_*.sql`, em ordem,
no **SQL Editor** do painel do Supabase e execute.

Com CLI (`supabase` instalado e projeto linkado):

```bash
supabase db push
```

## Ordem

1. `0001_fundacao.sql` — casos, documentos_caso, indices_cache, RLS, Storage,
   pgvector, tabelas vetoriais vazias.
2. `0002_pensao.sql` — Plano 02: pensao_parametros, pensao_parcelas, pensao_pagamentos, pensao_memoria + RLS.
3. `0003_partilha.sql` — Plano 03: partilha_config, partilha_bens, partilha_passivos, partilha_cenarios, partilha_memoria + RLS.

## Env

- **Browser** (`VITE_` prefix, no painel da Vercel e no `.env` local): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- **Servidor** (sem prefixo, no painel da Vercel e no `.env` local para `vercel dev`): `SUPABASE_URL`, `SUPABASE_ANON_KEY` — a mesma URL e a mesma anon key públicas, sem o prefixo `VITE_`. As funções em `api/` as usam para criar o client por request.
- **Seed local apenas** (nunca na Vercel): `SUPABASE_SERVICE_ROLE_KEY` (+ reaproveita `SUPABASE_URL`).
