# FamiliÁgil

Plataforma para advogados de família. Dois motores **independentes**:

1. **Execução de Pensão Alimentícia** — atualização parcela a parcela (SELIC/IPCA
   conforme o período, Lei 14.905/2024), memória de cálculo auditável.
2. **Partilha de Bens** — classificação de bens por regime, quinhões, tornas,
   enquadramento tributário (ITBI × ITCMD), linha do tempo.

Nenhum cálculo usa IA: são regra + aritmética determinísticas. Todo valor é
rastreável a um dado informado pelo advogado ou a um índice oficial do Banco
Central.

- **Front:** React 18 + Vite 5 + Tailwind CSS v4
- **Auth / dados:** Supabase (RLS por usuário)
- **Serverless:** Vercel (`api/`)
- **Índices:** API do SGS do Banco Central, com cache

## Rodando localmente

```bash
npm install
cp .env.example .env   # preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev
```

As rotas `/api/*` só rodam com `vercel dev` (não com `npm run dev`).

## Banco

Ver `supabase/README.md`. Aplicar as migrations em ordem.

## Chatbot "Lu" — pendente

O assistente RAG "Lu" está **desenhado, não implementado** neste momento
(decisão de custo — igual ao TributÁgil). Quando houver provedor/cota de IA:

- Fase Pensão e Fase Partilha têm **system messages próprias** e **coleções
  vetoriais separadas** (`pensao_*_chunks`, `partilha_*_chunks`).
- Temperatura 0; retrieval restrito a `case_id` + fase; sem trecho relevante →
  "não possuo essa informação" **sem chamar o modelo**; citação de fonte
  obrigatória. Ver o spec, seção 11.

## Isolamento

Ver `docs/isolamento.md` — checklists que precisam passar antes de cada release.
