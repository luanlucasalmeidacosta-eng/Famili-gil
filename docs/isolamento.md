# Checklists de isolamento

## Isolamento do TributÁgil (inviolável 8)

- [ ] `grep -ri "tributagil" --include=*.js --include=*.jsx --include=*.sql .` não retorna nada em código.
- [ ] Nenhuma env, tabela, bucket ou projeto Supabase compartilhado com o TributÁgil.
- [ ] `package.json` não tem dependência que só exista para reaproveitar código do TributÁgil.

## Isolamento entre fases (inviolável 9)

- [ ] Nenhum arquivo em `api/pensao/` importa de `api/partilha/` e vice-versa
      (`grep -rn "partilha" api/pensao/` e o inverso).
- [ ] Nenhuma query junta tabela `pensao_*` com `partilha_*`.
- [ ] `api/_core/` não importa de `api/pensao/` nem de `api/partilha/`.
- [ ] Remover a pasta e as tabelas de uma fase não quebra o build da outra.
