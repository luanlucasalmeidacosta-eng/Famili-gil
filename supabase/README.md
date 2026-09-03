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
2. `0002_pensao.sql` — Plano 02.
3. `0003_partilha.sql` — Plano 03.

## Env

- Front (Vercel + `.env` local): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Seed local apenas: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (nunca na Vercel).
