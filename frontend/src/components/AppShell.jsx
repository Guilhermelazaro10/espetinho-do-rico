import {
  LayoutGrid, Bike, ChefHat, TrendingUp, Users, UtensilsCrossed, LogOut, Smartphone,
} from 'lucide-react';
import { ToasterGlobal } from '../ui/toast';
import { ehGerente } from '../lib/constantes';

const ITENS_NAV = [
  { href: '#/', rotulo: 'Salao', Icone: LayoutGrid, gerente: false },
  { href: '#/delivery', rotulo: 'Delivery', Icone: Bike, gerente: false },
  { href: '#/cozinha', rotulo: 'Cozinha', Icone: ChefHat, gerente: false },
  { href: '#/financeiro', rotulo: 'Financeiro', Icone: TrendingUp, gerente: true },
  { href: '#/equipe', rotulo: 'Equipe', Icone: Users, gerente: true },
  { href: '#/cardapio', rotulo: 'Cardapio', Icone: UtensilsCrossed, gerente: true },
];

function itensVisiveis(sessao) {
  return ITENS_NAV.filter((item) => !item.gerente || ehGerente(sessao));
}

function rotaAtiva(href) {
  const hash = window.location.hash || '#/';
  return href === '#/' ? hash === '#/' || hash === '' : hash.startsWith(href);
}

export default function AppShell({ children, titulo, acoes = null, sessao, aoSair }) {
  const itens = itensVisiveis(sessao);

  return (
    <div className="flex min-h-dvh bg-rico-light">
      <ToasterGlobal />

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-rico-dark text-rico-light lg:flex">
        <div className="border-b border-rico-wood/20 px-5 py-5">
          <div className="rounded-xl border border-rico-wood/25 bg-rico-light/8 px-3 py-3 shadow-suave">
            <img
              src="/logo_clean.png"
              alt="Espetinho do Rico"
              className="mx-auto h-auto w-44 drop-shadow-[0_8px_18px_rgb(0_0_0/0.28)]"
            />
            <p className="mt-2 text-center text-[10px] font-bold uppercase tracking-[0.25em] text-rico-wood">
              Sistema PDV
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1.5 px-3 py-5">
          {itens.map(({ href, rotulo, Icone }) => {
            const ativa = rotaAtiva(href);
            return (
              <a
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition ${
                  ativa
                    ? 'bg-rico-red text-rico-light shadow-brasa'
                    : 'text-rico-light/58 hover:bg-rico-light/8 hover:text-rico-light'
                }`}
              >
                <Icone size={18} strokeWidth={2.25} />
                {rotulo}
                {ativa && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-rico-wood" />}
              </a>
            );
          })}
          <a
            href="#/garcom"
            className="mt-4 flex items-center gap-3 rounded-xl border border-dashed border-rico-wood/30 px-4 py-3 text-sm font-bold text-rico-light/45 transition hover:border-rico-wood/60 hover:text-rico-light"
          >
            <Smartphone size={18} /> Modo Garcom
          </a>
        </nav>

        <div className="border-t border-rico-wood/20 px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{sessao?.usuario?.nome}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-rico-wood">
                {sessao?.usuario?.papel}
              </p>
            </div>
            <button
              onClick={aoSair}
              className="rounded-lg p-2 text-rico-light/40 transition hover:bg-rico-red hover:text-rico-light"
              aria-label="Sair"
              title="Sair"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-h-dvh w-full flex-col lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-rico-wood/25 bg-rico-light/92 backdrop-blur">
          <div className="h-1 w-full bg-brasa-gradiente" />
          <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-7">
            <h1 className="font-display text-xl text-rico-dark sm:text-2xl">{titulo}</h1>
            <div className="flex items-center gap-3">
              {acoes}
              <button
                onClick={aoSair}
                className="rounded-lg p-2 text-carvao-suave transition hover:bg-rico-red/10 hover:text-rico-red lg:hidden"
                aria-label="Sair"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        <main className="w-full flex-1 px-4 py-6 pb-24 sm:px-7 lg:pb-8">{children}</main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-rico-wood/25 bg-rico-light/96 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 shadow-flutuante backdrop-blur lg:hidden"
        aria-label="Navegacao principal"
      >
        {itens.map(({ href, rotulo, Icone }) => {
          const ativa = rotaAtiva(href);
          return (
            <a
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-bold transition ${
                ativa ? 'text-rico-red' : 'text-carvao-suave'
              }`}
            >
              <span className={`rounded-xl px-3 py-1 ${ativa ? 'bg-rico-red/10' : ''}`}>
                <Icone size={20} strokeWidth={ativa ? 2.5 : 2} />
              </span>
              {rotulo}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
