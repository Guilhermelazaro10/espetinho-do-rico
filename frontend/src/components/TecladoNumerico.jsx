import { Delete } from 'lucide-react';

/*
 * Teclado numérico customizado — usado no login por PIN e na abertura
 * de mesa do garçom. Botões grandes (64px) para toque com pressa.
 * Tema "escuro" (telas carvão) ou "claro" (telas creme).
 */
export default function TecladoNumerico({ aoDigitar, aoApagar, aoLimpar, tema = 'escuro' }) {
  const estilos = {
    escuro: 'bg-rico-light/8 text-rico-light ring-rico-light/10 active:bg-rico-red',
    claro: 'bg-white text-carvao ring-rico-wood/35 shadow-suave active:bg-rico-light-escuro',
    premium:
      'bg-rico-light/12 text-rico-light ring-rico-wood/30 shadow-suave hover:bg-rico-light/18 active:bg-rico-red active:text-rico-light',
  }[tema] ?? 'bg-rico-light/8 text-rico-light ring-rico-light/10 active:bg-rico-red';

  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'limpar', '0', 'apagar'];

  function tocar(tecla) {
    if (tecla === 'limpar') return aoLimpar();
    if (tecla === 'apagar') return aoApagar();
    aoDigitar(tecla);
  }

  return (
    <div className="grid w-full grid-cols-3 gap-3">
      {teclas.map((tecla) => (
        <button
          key={tecla}
          onClick={() => tocar(tecla)}
          className={`flex h-16 items-center justify-center rounded-xl text-2xl font-extrabold
            ring-1 transition duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ${estilos}`}
          aria-label={tecla === 'apagar' ? 'Apagar' : tecla === 'limpar' ? 'Limpar' : tecla}
        >
          {tecla === 'apagar' ? (
            <Delete size={24} />
          ) : tecla === 'limpar' ? (
            <span className="text-sm font-bold uppercase opacity-60">Limpar</span>
          ) : (
            tecla
          )}
        </button>
      ))}
    </div>
  );
}
