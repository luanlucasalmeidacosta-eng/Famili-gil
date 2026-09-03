-- 0002_pensao.sql — FamiliÁgil, Fase 1 (Pensão Alimentícia).
-- Aplicar DEPOIS de 0001_fundacao.sql. Não referencia nenhuma tabela partilha_*.

-- helper de RLS: o caso pertence ao usuário atual?
create or replace function public.e_dono_do_caso(p_caso_id uuid) returns boolean
  language sql stable security invoker as $$
  select exists (select 1 from public.casos c where c.id = p_caso_id and c.user_id = (select auth.uid()))
$$;

-- ───────────────────────────  pensao_parametros  ──────────────────────
create table public.pensao_parametros (
  caso_id                      uuid primary key references public.casos (id) on delete cascade,
  user_id                      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo_valor                   text not null check (tipo_valor in ('fixo','pct_salario_minimo','pct_rendimento')),
  valor_base                   numeric not null,
  salario_minimo_ref           numeric,
  rendimento_ref               numeric,
  dia_vencimento               int not null check (dia_vencimento between 1 and 31),
  data_inicial                 date not null,
  data_final                   date not null,
  indice_correcao              text not null default 'legal'
                                 check (indice_correcao in ('legal','INPC','IGPM','IPCA-E','IPCA')),
  regra_imputacao              text not null default 'mais_antigas_primeiro'
                                 check (regra_imputacao in ('mais_antigas_primeiro','mais_recentes_primeiro','pro_rata')),
  regime_juros_convencionado   text not null default '1_am_simples'
                                 check (regime_juros_convencionado in ('1_am_simples','1_am_capitalizado','selic')),
  atualizado_em                timestamptz not null default now()
);
alter table public.pensao_parametros enable row level security;
create policy pensao_parametros_dono on public.pensao_parametros
  for all using (public.e_dono_do_caso(caso_id)) with check (public.e_dono_do_caso(caso_id));

-- ────────────────────────────  pensao_parcelas  ──────────────────────
create table public.pensao_parcelas (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  caso_id       uuid not null references public.casos (id) on delete cascade,
  competencia   date not null,
  vencimento    date not null,
  valor_devido  numeric not null,
  origem        text not null default 'gerada' check (origem in ('gerada','manual')),
  ativa         boolean not null default true,
  observacao    text
);
create index pensao_parcelas_caso on public.pensao_parcelas (caso_id);
alter table public.pensao_parcelas enable row level security;
create policy pensao_parcelas_dono on public.pensao_parcelas
  for all using (public.e_dono_do_caso(caso_id)) with check (public.e_dono_do_caso(caso_id));

-- ───────────────────────────  pensao_pagamentos  ─────────────────────
create table public.pensao_pagamentos (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  caso_id           uuid not null references public.casos (id) on delete cascade,
  data_pagamento    date not null,
  valor             numeric not null,
  identificado_para uuid references public.pensao_parcelas (id) on delete set null,
  observacao        text
);
create index pensao_pagamentos_caso on public.pensao_pagamentos (caso_id);
alter table public.pensao_pagamentos enable row level security;
create policy pensao_pagamentos_dono on public.pensao_pagamentos
  for all using (public.e_dono_do_caso(caso_id)) with check (public.e_dono_do_caso(caso_id));

-- ────────────────────────────  pensao_memoria  ──────────────────────
create table public.pensao_memoria (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users (id) on delete cascade,
  caso_id              uuid not null references public.casos (id) on delete cascade,
  versao               int not null,
  calculado_em         timestamptz not null default now(),
  data_base            date not null,
  parametros_snapshot  jsonb not null,
  series_snapshot      jsonb not null,
  linhas               jsonb not null,
  totais               jsonb not null,
  alertas              jsonb not null default '[]'::jsonb,
  unique (caso_id, versao)
);
create index pensao_memoria_caso on public.pensao_memoria (caso_id);
alter table public.pensao_memoria enable row level security;
-- memória é somente-leitura pelo cliente; a escrita vem da rota calcular.js,
-- que roda como o usuário (RLS) mas só faz INSERT — nunca UPDATE/DELETE.
create policy pensao_memoria_leitura on public.pensao_memoria
  for select using (public.e_dono_do_caso(caso_id));
create policy pensao_memoria_insere on public.pensao_memoria
  for insert with check (public.e_dono_do_caso(caso_id));
