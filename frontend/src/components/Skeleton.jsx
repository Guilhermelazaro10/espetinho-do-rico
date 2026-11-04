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
      className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(148px,calc(50%-6px)),1fr))] sm:gap-4"
      aria-label="Carregando mesas"
    >
      {Array.from({ length: quantidade }, (_, i) => (
        <SkeletonBloco key={i} className="h-[148px]" />
      ))}
    </div>
  );
}
