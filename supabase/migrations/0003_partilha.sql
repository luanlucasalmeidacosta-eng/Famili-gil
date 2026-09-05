-- 0003_partilha.sql — FamiliÁgil, Fase 2 (Partilha de Bens).
-- Aplicar DEPOIS de 0001_fundacao.sql e 0002_pensao.sql. Não referencia
-- nenhuma tabela pensao_*; reaproveita só e_dono_do_caso(uuid), que é
-- genérica (definida em 0002 mas não específica de Pensão).

-- ───────────────────────────  partilha_config  ─────────────────────
create table public.partilha_config (
  caso_id                uuid primary key references public.casos (id) on delete cascade,
  user_id                uuid not null default auth.uid() references auth.users (id) on delete cascade,
  regime_bens            text not null
                           check (regime_bens in ('comunhao_parcial','comunhao_universal','separacao_total','participacao_final_aquestos')),
  data_casamento         date not null,
  data_separacao_fato    date,
  separacao_fato_efeito  text not null default 'corta_comunicacao'
                           check (separacao_fato_efeito in ('corta_comunicacao','apenas_alerta')),
  data_ajuizamento       date,
  atualizado_em          timestamptz not null default now()
);
alter table public.partilha_config enable row level security;
create policy partilha_config_dono on public.partilha_config
  for all using (public.e_dono_do_caso(caso_id)) with check (public.e_dono_do_caso(caso_id));

-- ────────────────────────────  partilha_bens  ───────────────────────
create table public.partilha_bens (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  caso_id                     uuid not null references public.casos (id) on delete cascade,
  descricao                   text not null,
  tipo                        text not null check (tipo in ('imovel','veiculo','conta','investimento','empresa','movel','outro')),
  valor_mercado               numeric not null,
  data_aquisicao              date,
  forma_aquisicao             text check (forma_aquisicao in ('oneroso','doacao','heranca','legado','sub_rogacao','fato_eventual','beneficiaria_particular')),
  clausula_incomunicabilidade boolean not null default false,
  titular                     text not null check (titular in ('parte_a','parte_b','ambos')),
  financiado                  boolean not null default false,
  saldo_devedor               numeric,
  classificacao_override      text check (classificacao_override in ('comunicavel','particular')),
  observacao                  text
);
create index partilha_bens_caso on public.partilha_bens (caso_id);
alter table public.partilha_bens enable row level security;
create policy partilha_bens_dono on public.partilha_bens
  for all using (public.e_dono_do_caso(caso_id)) with check (public.e_dono_do_caso(caso_id));

-- ─────────────────────────  partilha_passivos  ─────────────────────
create table public.partilha_passivos (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  caso_id          uuid not null references public.casos (id) on delete cascade,
  descricao        text not null,
  valor            numeric not null,
  natureza         text not null check (natureza in ('anterior_casamento','constancia_proveito_comum','constancia_particular','ato_ilicito','tributo_de_bem','outro')),
  responsavel      text not null check (responsavel in ('parte_a','parte_b','ambos')),
  bem_vinculado_id uuid references public.partilha_bens (id) on delete set null
);
create index partilha_passivos_caso on public.partilha_passivos (caso_id);
alter table public.partilha_passivos enable row level security;
create policy partilha_passivos_dono on public.partilha_passivos
  for all using (public.e_dono_do_caso(caso_id)) with check (public.e_dono_do_caso(caso_id));

-- ─────────────────────────  partilha_cenarios  ─────────────────────
create table public.partilha_cenarios (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  caso_id       uuid not null references public.casos (id) on delete cascade,
  rotulo        text not null,
  pct_parte_a   numeric not null default 50,
  alocacoes     jsonb not null default '[]'::jsonb,
  tornas        jsonb not null default '[]'::jsonb,
  criado_em     timestamptz not null default now()
);
create index partilha_cenarios_caso on public.partilha_cenarios (caso_id);
alter table public.partilha_cenarios enable row level security;
create policy partilha_cenarios_dono on public.partilha_cenarios
  for all using (public.e_dono_do_caso(caso_id)) with check (public.e_dono_do_caso(caso_id));

-- ─────────────────────────  partilha_memoria  ──────────────────────
create table public.partilha_memoria (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  caso_id             uuid not null references public.casos (id) on delete cascade,
  cenario_id          uuid not null references public.partilha_cenarios (id) on delete cascade,
  versao              int not null,
  calculado_em        timestamptz not null default now(),
  entradas_snapshot   jsonb not null,
  linhas_bens         jsonb not null,
  quadro_quinhoes     jsonb not null,
  linha_tempo         jsonb not null,
  alertas_tributarios jsonb not null default '[]'::jsonb,
  totais              jsonb not null,
  alertas             jsonb not null default '[]'::jsonb,
  unique (caso_id, versao)
);
create index partilha_memoria_caso on public.partilha_memoria (caso_id);
alter table public.partilha_memoria enable row level security;
create policy partilha_memoria_leitura on public.partilha_memoria
  for select using (public.e_dono_do_caso(caso_id));
create policy partilha_memoria_insere on public.partilha_memoria
  for insert with check (public.e_dono_do_caso(caso_id));
