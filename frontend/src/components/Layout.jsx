import { ChefHat, Calculator, LogOut, LayoutGrid } from 'lucide-react';
import { ToasterGlobal } from '../ui/toast';

function SeloMarca() {
  return (
    <div className="inline-flex items-center justify-center rounded-xl border border-rico-wood/30 bg-white/85 px-5 py-2 shadow-suave">
      <img src="/logo_clean.png" alt="Espetinho do Rico" className="h-auto w-52" />
    </div>
  );
}

function LinkModulo({ href, icone: Icone, rotulo, ativo }) {
  return (
    <a
      href={href}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${
        ativo
          ? 'bg-rico-red text-rico-light shadow-brasa'
          : 'text-carvao-suave hover:bg-rico-wood/15 hover:text-carvao'
      }`}
    >
      <Icone size={14} /> {rotulo}
    </a>
  );
}

export default function Layout({ children, acoes = null, sessao = null, aoSair = null }) {
  const papel = sessao?.usuario?.papel;
  const rota = window.location.hash;

  return (
    <div className="flex min-h-screen flex-col bg-rico-light">
      <ToasterGlobal />

      <header className="relative border-b border-rico-wood/25 bg-rico-light">
        <div className="h-1 w-full bg-brasa-gradiente" />

        {sessao && (
          <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-xl bg-white/75 p-1 shadow-suave ring-1 ring-rico-wood/20">
            <LinkModulo href="#/" icone={LayoutGrid} rotulo="Caixa" ativo={!rota || rota === '#/'} />
            <LinkModulo href="#/cozinha" icone={ChefHat} rotulo="Cozinha" ativo={rota.startsWith('#/cozinha')} />
            {(papel === 'caixa' || papel === 'gerente' || papel === 'GERENTE') && (
              <LinkModulo
                href="#/fechamento"
                icone={Calculator}
                rotulo="Fechamento"
                ativo={rota.startsWith('#/fechamento')}
              />
            )}
            <span className="ml-2 hidden text-xs font-semibold text-carvao-suave sm:inline">
              {sessao.usuario.nome}
            </span>
            <button
              onClick={aoSair}
              className="ml-1 rounded-lg p-1.5 text-carvao-suave transition hover:bg-rico-red/10 hover:text-rico-red"
              aria-label="Sair"
              title="Sair"
            >
              <LogOut size={15} />
            </button>
          </div>
        )}

        <div className="mx-auto flex max-w-7xl items-center justify-center px-4 pb-4 pt-5">
          <SeloMarca />
        </div>

        {acoes && (
          <div className="mx-auto flex max-w-7xl items-center justify-center px-4 pb-4">
            {acoes}
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-7 sm:px-6">{children}</main>

      <footer className="flex items-center justify-center gap-3 border-t border-rico-wood/25 py-4">
        <p className="text-xs font-medium text-carvao-suave">
          Espetinho do Rico - Sistema PDV
        </p>
        <a
          href="#/garcom"
          className="rounded-full bg-rico-dark px-3 py-1 text-[11px] font-bold text-rico-light transition hover:bg-carvao-claro"
        >
          Modo Garcom
        </a>
      </footer>
    </div>
  );
}
