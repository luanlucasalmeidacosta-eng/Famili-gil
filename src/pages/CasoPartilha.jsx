export default function CasoPartilha({ caso }) {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-lg font-semibold">{caso?.titulo} — Partilha de Bens</h1>
      <p className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm">
        Motor de Partilha em implementação (Plano 03).
      </p>
    </div>
  )
}
