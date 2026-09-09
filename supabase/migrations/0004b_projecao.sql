-- 0004b_projecao.sql — FamiliÁgil, Plano 04b.
-- Aplicar DEPOIS de 0002. Não referencia nenhuma tabela partilha_*.

-- ─────────────────────  focus_projecoes  ─────────────────────
-- Cache das projeções de mercado do Boletim Focus (BCB). Escrita via
-- service_role (bypassa RLS), igual a indices_cache.
create table public.focus_projecoes (
  serie        text not null check (serie in ('IPCA','SELIC')),
  competencia  date not null,
  mediana      numeric not null,
  data_boletim date not null,
  buscado_em   timestamptz not null default now(),
  primary key (serie, competencia, data_boletim)
);
alter table public.focus_projecoes enable row level security;
create policy focus_projecoes_leitura on public.focus_projecoes
  for select to authenticated using (true);

-- nota editável sobre admissibilidade da correção projetada, por caso
alter table public.pensao_parametros add column projecao_nota text;
