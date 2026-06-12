import { lazy, Suspense, useEffect, useState } from 'react';
import { Flame } from 'lucide-react';
import Login from './pages/Login';
import { obterSessao, limparSessao } from './lib/sessao';

// Code splitting: cada módulo só baixa o próprio código
const Salao = lazy(() => import('./pages/Salao'));
const Garcom = lazy(() => import('./pages/Garcom'));
const Cozinha = lazy(() => import('./pages/Cozinha'));
const Fechamento = lazy(() => import('./pages/Fechamento'));
const DeliveryBalcao = lazy(() => import('./pages/DeliveryBalcao'));
const Financeiro = lazy(() => import('./pages/Financeiro'));
const Equipe = lazy(() => import('./pages/Equipe'));
const Cardapio = lazy(() => import('./pages/Cardapio'));

// Roteamento por hash, sem dependências:
//   #/           → Caixa (desktop)   #/garcom     → Garçom (mobile PWA)
//   #/cozinha    → KDS da chapa      #/fechamento → Relatório do dia
function useRota() {
  const [rota, setRota] = useState(window.location.hash);
  useEffect(() => {
    const atualizar = () => setRota(window.location.hash);
    window.addEventListener('hashchange', atualizar);
    return () => window.removeEventListener('hashchange', atualizar);
  }, []);
  return rota;
}

function Carregando() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-rico-light">
      <Flame size={32} className="animate-pulse text-rico-red" />
    </div>
  );
}

export default function App() {
  const rota = useRota();
  const [sessao, setSessao] = useState(obterSessao);

  // API derruba a sessão local ao receber 401 (token expirado/inválido)
  useEffect(() => {
    const deslogar = () => setSessao(null);
    window.addEventListener('pdv:sessao-expirada', deslogar);
    return () => window.removeEventListener('pdv:sessao-expirada', deslogar);
  }, []);

  if (!sessao) return <Login aoEntrar={setSessao} />;

  const sair = () => {
    limparSessao();
    window.location.hash = '#/';
    setSessao(null);
  };

  let Tela = Salao;
  if (rota.startsWith('#/garcom')) Tela = Garcom;
  else if (rota.startsWith('#/cozinha')) Tela = Cozinha;
  else if (rota.startsWith('#/fechamento')) Tela = Fechamento;
  else if (rota.startsWith('#/delivery')) Tela = DeliveryBalcao;
  else if (rota.startsWith('#/financeiro')) Tela = Financeiro;
  else if (rota.startsWith('#/equipe')) Tela = Equipe;
  else if (rota.startsWith('#/cardapio')) Tela = Cardapio;

  return (
    <Suspense fallback={<Carregando />}>
      <Tela sessao={sessao} aoSair={sair} />
    </Suspense>
  );
}
