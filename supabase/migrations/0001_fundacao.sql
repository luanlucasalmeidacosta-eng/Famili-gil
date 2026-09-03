-- 0001_fundacao.sql — FamiliÁgil, esquema comum às fases.

create extension if not exists vector;

-- ─────────────────────────────  casos  ─────────────────────────────
create table public.casos (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo            text not null check (tipo in ('pensao', 'partilha')),
  titulo          text not null,
  numero_processo text,
  parte_a         text not null default '',
  parte_b         text not null default '',
  data_citacao    date,
  arquivado       boolean not null default false,
  criado_em       timestamptz not null default now()
);
alter table public.casos enable row level security;
create policy casos_dono on public.casos
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─────────────────────────  documentos_caso  ───────────────────────
create table public.documentos_caso (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  caso_id      uuid not null references public.casos (id) on delete cascade,
  nome         text not null,
  storage_path text not null,
  tipo         text not null check (tipo in ('sentenca','acordo','comprovante','extrato','matricula','outro')),
  enviado_em   timestamptz not null default now()
);
alter table public.documentos_caso enable row level security;
create policy documentos_dono on public.documentos_caso
  for all using (
    user_id = auth.uid()
    and exists (select 1 from public.casos c where c.id = caso_id and c.user_id = auth.uid())
  ) with check (
    user_id = auth.uid()
    and exists (select 1 from public.casos c where c.id = caso_id and c.user_id = auth.uid())
  );

-- ──────────────────────────  indices_cache  ────────────────────────
create table public.indices_cache (
  serie      text not null check (serie in ('SELIC_DIARIA','IPCA','INPC','IGPM','IPCA15')),
  ref        date not null,
  valor      numeric not null,
  buscado_em timestamptz not null default now(),
  primary key (serie, ref)
);
alter table public.indices_cache enable row level security;
-- leitura para qualquer usuário autenticado; escrita só via service_role (bypassa RLS)
create policy indices_leitura on public.indices_cache
  for select using (auth.role() = 'authenticated');

-- ───────────────────────  tabelas vetoriais (Lu — vazias)  ─────────
create table public.pensao_legislacao_chunks (
  id uuid primary key default gen_random_uuid(),
  norma text not null, dispositivo text not null, texto_integral text not null,
  embedding vector(768)
);
create table public.pensao_documento_chunks (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid references public.casos (id) on delete cascade,
  documento_id uuid references public.documentos_caso (id) on delete cascade,
  trecho text not null, pagina int, embedding vector(768)
);
create table public.partilha_legislacao_chunks (
  id uuid primary key default gen_random_uuid(),
  norma text not null, dispositivo text not null, texto_integral text not null,
  embedding vector(768)
);
create table public.partilha_documento_chunks (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid references public.casos (id) on delete cascade,
  documento_id uuid references public.documentos_caso (id) on delete cascade,
  trecho text not null, pagina int, embedding vector(768)
);
alter table public.pensao_legislacao_chunks   enable row level security;
alter table public.pensao_documento_chunks    enable row level security;
alter table public.partilha_legislacao_chunks enable row level security;
alter table public.partilha_documento_chunks  enable row level security;
-- sem policy = sem acesso pelo client; uso só quando o Lu for implementado.

-- ─────────────────────────────  Storage  ───────────────────────────
insert into storage.buckets (id, name, public) values ('documentos', 'documentos', false)
  on conflict (id) do nothing;
create policy documentos_bucket_dono on storage.objects
  for all using (
    bucket_id = 'documentos' and owner = auth.uid()
  ) with check (
    bucket_id = 'documentos' and owner = auth.uid()
  );
