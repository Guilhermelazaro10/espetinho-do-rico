import { useEffect, useState } from 'react';
import {
  LayoutGrid, Bike, ChefHat, TrendingUp, Wallet, Users, UtensilsCrossed, LogOut, Smartphone, Printer,
  Ellipsis,
} from 'lucide-react';
import { notificar, ToasterGlobal } from '../ui/toast';
import { ehGerente, PAPEIS } from '../lib/constantes';
import { baseUrl, ehNativo } from '../lib/servidor';
import { tocarCampainha } from '../lib/som';
import Sheet from '../ui/Sheet';

// Ordem do menu lateral (desktop). No celular, `fixo` define os 4 destinos
// da barra; o resto vai para o "Mais". Rotas e permissões não mudaram.
const ITENS_NAV = [
  { href: '#/', rotulo: 'Salão', Icone: LayoutGrid, gerente: false, fixo: true },
  { href: '#/delivery', rotulo: 'Delivery', Icone: Bike, gerente: false, fixo: true },
  { href: '#/cozinha', rotulo: 'Cozinha', Icone: ChefHat, gerente: false, fixo: true },
  { href: '#/garcom', rotulo: 'Garçom', Icone: Smartphone, gerente: false, fixo: false },
  { href: '#/caixa', rotulo: 'Caixa', Icone: Wallet, gerente: true, fixo: true },
  { href: '#/financeiro', rotulo: 'Financeiro', Icone: TrendingUp, gerente: true, fixo: false },
  { href: '#/equipe', rotulo: 'Equipe', Icone: Users, gerente: true, fixo: false },
  { href: '#/cardapio', rotulo: 'Cardápio', Icone: UtensilsCrossed, gerente: true, fixo: false },
  { href: '#/impressora', rotulo: 'Impressão', Icone: Printer, gerente: true, fixo: false },
];

const NOME_PAPEL = { [PAPEIS.GERENTE]: 'Gerente', [PAPEIS.GARCOM]: 'Garçom' };

function itensVisiveis(sessao) {
  return ITENS_NAV.filter((item) => !item.gerente || ehGerente(sessao));
}

function rotaAtiva(href) {
  const hash = window.location.hash || '#/';
  return href === '#/' ? hash === '#/' || hash === '' : hash.startsWith(href);
}

export default function AppShell({ children, titulo, tituloCurto, acoes = null, sessao, aoSair }) {
  const itens = itensVisiveis(sessao);
  const [maisAberto, setMaisAberto] = useState(false);

  // Celular: até 5 destinos cabem direto; acima disso, 4 fixos + "Mais".
  const cabemTodos = itens.length <= 5;
  const fixos = cabemTodos ? itens : itens.filter((i) => i.fixo);
  const extras = cabemTodos ? [] : itens.filter((i) => !i.fixo);
  const extraAtivo = extras.some((i) => rotaAtiva(i.href));

  // Campainha de pedido online: toca em QUALQUER tela do PDV — ninguém
  // precisa ficar vigiando a aba Delivery para saber que entrou pedido.
  useEffect(() => {
    if (ehNativo()) return undefined; // APK do garçom usa polling, sem SSE
    const fonte = new EventSource(`${baseUrl()}/api/eventos`);
    fonte.onmessage = (evento) => {
      try {
        const dados = JSON.parse(evento.data);
        if (dados?.tipo === 'pedido_criado' && dados.online) {
          tocarCampainha();
          notificar.brasa('Pedido do cardápio online', 'Abra a aba Delivery para aceitar ou recusar');
        }
      } catch {
        /* evento sem JSON (ping) — ignora */
      }
    };
    fonte.onerror = () => {}; // EventSource reconecta sozinho
    return () => fonte.close();
  }, []);

  return (
    <div className="flex min-h-dvh bg-creme">
      <ToasterGlobal />

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col bg-carvao text-creme lg:flex">
        <div className="px-3 pb-2 pt-5">
          <div className="rounded-2xl border border-creme/10 bg-creme/6 px-3 py-3.5">
            <img
              src="/logo_clean.png"
              alt="Espetinho do Rico"
              width="845"
              height="466"
              className="mx-auto h-auto w-[150px]"
            />
          </div>
        </div>

        <nav aria-label="Navegação principal" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {itens.map(({ href, rotulo, Icone }) => {
            const ativa = rotaAtiva(href);
            return (
              <a
                key={href}
                href={href}
                aria-current={ativa ? 'page' : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-lg px-3.5 text-sm font-semibold transition-colors ${
                  ativa ? 'bg-rico-red text-white' : 'text-creme/80 hover:bg-creme/8 hover:text-creme'
                }`}
              >
                <Icone size={20} aria-hidden="true" />
                {rotulo}
              </a>
            );
          })}
        </nav>

        <div className="mx-3 flex items-center justify-between gap-2 border-t border-creme/10 px-1.5 py-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{sessao?.usuario?.nome}</p>
            <p className="text-xs font-semibold text-rico-wood">
              {NOME_PAPEL[sessao?.usuario?.papel] ?? sessao?.usuario?.papel}
            </p>
          </div>
          <button
            type="button"
            onClick={aoSair}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-creme/14 text-creme/80 transition-colors hover:bg-rico-red hover:text-white"
            aria-label="Sair"
            title="Sair"
          >
            <LogOut size={18} aria-hidden="true" />
          </button>
        </div>
      </aside>

      <div className="flex min-h-dvh w-full min-w-0 flex-col lg:pl-[248px]">
        <header className="safe-area-top sticky top-0 z-20 border-b border-rico-wood/30 bg-creme">
          <div className="mx-auto flex min-h-16 w-full max-w-[1440px] items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:min-h-[72px] lg:px-8">
            <h1 className="min-w-0 truncate font-display text-xl text-carvao sm:text-2xl">
              {tituloCurto ? (
                <>
                  <span className="sm:hidden">{tituloCurto}</span>
                  <span className="hidden sm:inline">{titulo}</span>
                </>
              ) : (
                titulo
              )}
            </h1>
            <div className="flex shrink-0 items-center gap-2">
              {acoes}
              <button
                type="button"
                onClick={aoSair}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-carvao-suave transition-colors hover:bg-erro-fundo hover:text-rico-red lg:hidden"
                aria-label="Sair"
                title="Sair"
              >
                <LogOut size={20} aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>

        <main className="safe-area-content-bottom mx-auto w-full min-w-0 max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:pb-8">
          {children}
        </main>
      </div>

      <nav
        className="safe-area-bottom-nav fixed inset-x-0 bottom-0 z-30 grid border-t border-rico-wood/30 bg-creme px-1 pt-1 lg:hidden"
        style={{ gridTemplateColumns: `repeat(${fixos.length + (extras.length ? 1 : 0)}, minmax(0, 1fr))` }}
        aria-label="Navegação principal"
      >
        {fixos.map(({ href, rotulo, Icone }) => (
          <ItemBarra key={href} href={href} rotulo={rotulo} Icone={Icone} ativa={rotaAtiva(href)} />
        ))}
        {extras.length > 0 && (
          <ItemBarra
            rotulo="Mais"
            Icone={Ellipsis}
            ativa={extraAtivo}
            aoClicar={() => setMaisAberto(true)}
            expandido={maisAberto}
          />
        )}
      </nav>

      <Sheet aberto={maisAberto} aoFechar={() => setMaisAberto(false)} titulo="Mais" lado="centro">
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {extras.map(({ href, rotulo, Icone }) => {
            const ativa = rotaAtiva(href);
            return (
              <li key={href}>
                <a
                  href={href}
                  onClick={() => setMaisAberto(false)}
                  aria-current={ativa ? 'page' : undefined}
                  className={`flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-xl border text-sm font-semibold transition-colors ${
                    ativa
                      ? 'border-rico-red bg-erro-fundo text-rico-red'
                      : 'border-rico-wood/35 bg-white text-carvao hover:bg-creme-escuro'
                  }`}
                >
                  <Icone size={22} aria-hidden="true" />
                  {rotulo}
                </a>
              </li>
            );
          })}
        </ul>
      </Sheet>
    </div>
  );
}

function ItemBarra({ href, rotulo, Icone, ativa, aoClicar, expandido }) {
  const classe = `flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-xs font-semibold transition-colors ${
    ativa ? 'text-rico-red' : 'text-carvao-suave hover:text-carvao'
  }`;
  const conteudo = (
    <>
      <span className={`grid h-7 w-12 place-items-center rounded-full ${ativa ? 'bg-erro-fundo' : ''}`}>
        <Icone size={21} strokeWidth={ativa ? 2.4 : 2} aria-hidden="true" />
      </span>
      <span className="max-w-full truncate leading-none">{rotulo}</span>
    </>
  );
  if (aoClicar) {
    return (
      <button type="button" onClick={aoClicar} aria-haspopup="dialog" aria-expanded={expandido} className={classe}>
        {conteudo}
      </button>
    );
  }
  return (
    <a href={href} aria-current={ativa ? 'page' : undefined} className={classe}>
      {conteudo}
    </a>
  );
}
