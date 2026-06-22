import { lazy, Suspense, useEffect, useState } from 'react';
import { Flame } from 'lucide-react';
import Login from './pages/Login';
import ConfigServidor from './pages/ConfigServidor';
import { obterSessao, limparSessao } from './lib/sessao';
import { ehNativo, limparServidor } from './lib/servidor';

// Code splitting: cada módulo só baixa o próprio código
const Salao = lazy(() => import('./pages/Salao'));
const Garcom = lazy(() => import('./pages/Garcom'));
const Cozinha = lazy(() => import('./pages/Cozinha'));
const DeliveryBalcao = lazy(() => import('./pages/DeliveryBalcao'));
const CaixaTurno = lazy(() => import('./pages/CaixaTurno'));
const Financeiro = lazy(() => import('./pages/Financeiro'));
const Equipe = lazy(() => import('./pages/Equipe'));
const Cardapio = lazy(() => import('./pages/Cardapio'));
const Impressora = lazy(() => import('./pages/Impressora'));
const Pedir = lazy(() => import('./pages/Pedir'));

// Roteamento por hash, sem dependências:
//   #/           → Salão (desktop)   #/garcom     → Garçom (mobile PWA/APK)
//   #/cozinha    → KDS da chapa      #/financeiro → Dashboard do gerente
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
  // App nativo (APK): localiza/valida o PDV na rede antes de tudo.
  // Web já está "conectado" (mesma origem / proxy).
  const [conectado, setConectado] = useState(() => !ehNativo());

  // API derruba a sessão local ao receber 401 (token expirado/inválido)
  useEffect(() => {
    const deslogar = () => setSessao(null);
    window.addEventListener('pdv:sessao-expirada', deslogar);
    return () => window.removeEventListener('pdv:sessao-expirada', deslogar);
  }, []);

  // Cardápio online do cliente: público, ANTES do login. Aceita a URL limpa
  // /cardapio ou o hash #/pedir.
  if (rota.startsWith('#/pedir') || window.location.pathname.startsWith('/cardapio')) {
    return (
      <Suspense fallback={<Carregando />}>
        <Pedir />
      </Suspense>
    );
  }

  if (!conectado) {
    return <ConfigServidor aoConectar={() => setConectado(true)} />;
  }

  if (!sessao) {
    return (
      <Login
        aoEntrar={setSessao}
        aoTrocarServidor={
          ehNativo()
            ? () => {
                limparServidor();
                setConectado(false);
              }
            : null
        }
      />
    );
  }

  const sair = () => {
    limparSessao();
    window.location.hash = '#/';
    setSessao(null);
  };

  let Tela = Salao;
  if (rota.startsWith('#/garcom')) Tela = Garcom;
  else if (rota.startsWith('#/cozinha')) Tela = Cozinha;
  else if (rota.startsWith('#/caixa')) Tela = CaixaTurno;
  else if (rota.startsWith('#/delivery')) Tela = DeliveryBalcao;
  else if (rota.startsWith('#/financeiro')) Tela = Financeiro;
  else if (rota.startsWith('#/equipe')) Tela = Equipe;
  else if (rota.startsWith('#/cardapio')) Tela = Cardapio;
  else if (rota.startsWith('#/impressora')) Tela = Impressora;

  return (
    <Suspense fallback={<Carregando />}>
      <Tela sessao={sessao} aoSair={sair} />
    </Suspense>
  );
}
