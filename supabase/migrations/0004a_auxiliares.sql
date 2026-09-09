-- 0004a_auxiliares.sql — FamiliÁgil, Plano 04a.
-- Aplicar DEPOIS de 0001/0002/0003. Não referencia nenhuma tabela pensao_*.

-- ─────────────────────  aliquotas_biblioteca  ─────────────────────
create table public.aliquotas_biblioteca (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo          text not null check (tipo in ('itbi','itcmd')),
  uf            text not null check (char_length(uf) = 2),
  municipio     text,
  aliquota      numeric,
  faixas        jsonb not null default '[]'::jsonb,
  norma         text not null,
  fonte_url     text,
  observacao    text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint aliquota_itbi_tem_municipio check (tipo <> 'itbi' or municipio is not null),
  constraint aliquota_itbi_tem_aliquota  check (tipo <> 'itbi' or aliquota is not null),
  constraint aliquota_itcmd_tem_faixas   check (tipo <> 'itcmd' or jsonb_array_length(faixas) >= 1)
);
create unique index aliquotas_bib_chave
  on public.aliquotas_biblioteca (user_id, tipo, uf, coalesce(municipio, ''));
alter table public.aliquotas_biblioteca enable row level security;
create policy aliquotas_bib_dono on public.aliquotas_biblioteca
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ─────────────────────  biblioteca_categorias  ─────────────────────
create table public.biblioteca_categorias (
  slug   text primary key,
  rotulo text not null,
  ordem  int not null default 0
);
insert into public.biblioteca_categorias (slug, rotulo, ordem) values
  ('aliquota_itbi',  'Alíquotas de ITBI',  10),
  ('aliquota_itcmd', 'Alíquotas de ITCMD', 20);
alter table public.biblioteca_categorias enable row level security;
create policy biblioteca_categorias_leitura on public.biblioteca_categorias
  for select to authenticated using (true);

-- ───────────  contexto do enquadramento no caso de Partilha  ───────────
alter table public.partilha_config add column uf        text;
alter table public.partilha_config add column municipio text;

-- ───────────  alíquota/norma aplicadas por cenário  ───────────
alter table public.partilha_cenarios add column tributario_input jsonb;
