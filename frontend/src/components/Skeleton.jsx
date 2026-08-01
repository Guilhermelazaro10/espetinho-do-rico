/*
 * Esqueleto de carregamento: no lugar de tela em branco ou "Carregando…",
 * mostra a silhueta do conteúdo pulsando — a tela parece pronta antes de estar.
 */
export function SkeletonBloco({ className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-xl bg-rico-wood/15 ${className}`}
    />
  );
}

// Silhueta do mapa de mesas do Salão
export function SkeletonMesas({ quantidade = 10 }) {
  return (
    <div
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
      aria-label="Carregando mesas"
    >
      {Array.from({ length: quantidade }, (_, i) => (
        <SkeletonBloco key={i} className="min-h-36" />
      ))}
    </div>
  );
}
