// api/_core/cache-indices.js
//
// Adaptador do cachePort de resolverSeries (indices-bcb.js) para a tabela
// `indices_cache` do Supabase. Recebe o client já autenticado (RLS permite
// SELECT a qualquer usuário autenticado; o INSERT/UPSERT de índice roda como
// o usuário — a policy de escrita é do backend/seed, então em runtime a
// gravação pode falhar por RLS: nesse caso o erro é propagado e a rota
// responde erro, nunca calcula com furo).

export function criarCachePort(supabase) {
  return {
    async ler(chave, inicioISO, fimISO) {
      const { data, error } = await supabase
        .from('indices_cache')
        .select('ref, valor')
        .eq('serie', chave)
        .gte('ref', inicioISO)
        .lte('ref', fimISO)
      if (error) throw new Error(`cache ler ${chave}: ${error.message}`)
      const out = {}
      for (const row of data || []) out[String(row.ref).slice(0, 10)] = Number(row.valor)
      return out
    },
    async gravar(chave, linhas) {
      if (!linhas.length) return
      const rows = linhas.map(({ ref, valor }) => ({ serie: chave, ref, valor }))
      const { error } = await supabase.from('indices_cache').upsert(rows, { onConflict: 'serie,ref' })
      if (error) {
        // Best-effort: os dados já foram buscados com sucesso no BCB e seguem
        // em uso nesta requisição; só o cache para a PRÓXIMA fica sem
        // atualizar (ex.: RLS nega escrita a authenticated — a tabela é
        // pensada pra ser escrita pelo seed/service_role). Não falhar a
        // requisição por isso.
        console.warn(`cache-indices: falha ao gravar ${chave} (seguindo sem cache): ${error.message}`)
      }
    },
  }
}
