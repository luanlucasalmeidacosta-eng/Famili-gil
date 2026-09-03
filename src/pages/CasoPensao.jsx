export default function CasoPensao({ caso }) {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-lg font-semibold">{caso?.titulo} — Pensão Alimentícia</h1>
      <p className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm">
        Motor de Pensão em implementação (Plano 02).
      </p>
    </div>
  )
}
