import { useCallback, useEffect, useMemo, useState } from 'react';
import { WifiOff, Plus, Armchair } from 'lucide-react';
import AppShell from '../components/AppShell';
import MesaCard from '../components/MesaCard';
import SidebarConta from '../components/SidebarConta';
import { SkeletonMesas } from '../components/Skeleton';
import { api } from '../lib/api';
import { notificar } from '../ui/toast';
import { useAtualizacaoAoVivo } from '../hooks/useAtualizacaoAoVivo';
import { STATUS_MESA, TIPOS_PEDIDO, ehGerente } from '../lib/constantes';

/*
 * Salão — mapa de mesas (desktop e tablet do caixa).
 * Verde livre · Vermelho ocupada · Amarelo aguardando pagamento.
 */
export default function Salao({ sessao, aoSair }) {
  const [mesas, setMesas] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [mesaSelecionadaId, setMesaSelecionadaId] = useState(null);
  const [semConexao, setSemConexao] = useState(false);
  const [carregou, setCarregou] = useState(false);

  const recarregar = useCallback(async () => {
    try {
      const [m, p] = await Promise.all([
        api.mesas.listar(),
        api.pedidos.listarAbertos(TIPOS_PEDIDO.MESA),
      ]);
      setMesas(m);
      setPedidos(p);
      setSemConexao(false);
      setCarregou(true);
    } catch {
      setSemConexao(true);
    }
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);
  useAtualizacaoAoVivo(recarregar);

  const totalPorMesa = useMemo(() => {
    const mapa = new Map();
    for (const pedido of pedidos) {
      mapa.set(pedido.mesaId, (mapa.get(pedido.mesaId) ?? 0) + pedido.total);
    }
    return mapa;
  }, [pedidos]);

  // Comanda mais antiga de cada mesa: é o "ocupada há X min" do card
  const desdePorMesa = useMemo(() => {
    const mapa = new Map();
    for (const pedido of pedidos) {
      const atual = mapa.get(pedido.mesaId);
      if (!atual || new Date(pedido.criadoEm) < new Date(atual)) {
        mapa.set(pedido.mesaId, pedido.criadoEm);
      }
    }
    return mapa;
  }, [pedidos]);

  const mesaSelecionada = mesas.find((m) => m.id === mesaSelecionadaId) ?? null;

  const resumo = useMemo(
    () => ({
      livres: mesas.filter((m) => m.status === STATUS_MESA.LIVRE).length,
      ocupadas: mesas.filter((m) => m.status === STATUS_MESA.OCUPADA).length,
      aguardando: mesas.filter((m) => m.status === STATUS_MESA.AGUARDANDO_PAGAMENTO).length,
    }),
    [mesas]
  );

  const gerente = ehGerente(sessao);

  async function adicionarMesa() {
    try {
      const mesa = await api.mesas.criar();
      notificar.sucesso('Mesa adicionada', `Mesa ${String(mesa.numero).padStart(2, '0')}`);
      await recarregar();
    } catch (e) {
      notificar.erro('Não foi possível adicionar a mesa', e.message);
    }
  }

  const legenda = (
    <div className="flex items-center gap-3">
      {/* No celular a legenda encolhe para bolinha+número, mas nunca some */}
      <div className="flex items-center gap-2.5 text-xs font-bold text-carvao-claro sm:gap-4">
        <span className="flex items-center gap-1.5" title="Mesas livres">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span className="hidden sm:inline">Livres ·</span> {resumo.livres}
        </span>
        <span className="flex items-center gap-1.5" title="Mesas ocupadas">
          <span className="h-2.5 w-2.5 rounded-full bg-rico-red" />
          <span className="hidden sm:inline">Ocupadas ·</span> {resumo.ocupadas}
        </span>
        <span className="flex items-center gap-1.5" title="Aguardando pagamento">
          <span className="h-2.5 w-2.5 rounded-full bg-rico-wood" />
          <span className="hidden sm:inline">Aguardando ·</span> {resumo.aguardando}
        </span>
      </div>
      {gerente && (
        <button
          onClick={adicionarMesa}
          className="flex min-h-10 items-center gap-1.5 rounded-lg bg-rico-red px-3 py-2 text-xs font-bold text-rico-light shadow-brasa transition hover:-translate-y-0.5 active:translate-y-0"
        >
          <Plus size={15} /> Mesa
        </button>
      )}
    </div>
  );

  return (
    <AppShell titulo="Salão" acoes={legenda} sessao={sessao} aoSair={aoSair}>
      {semConexao && (
        <div
          className="mb-5 flex items-center gap-3 rounded-xl border border-rico-red/30
            bg-rico-red/5 px-4 py-3 text-sm font-semibold text-rico-red"
          role="alert"
        >
          <WifiOff size={18} />
          Sem conexão com o servidor — tentando reconectar…
        </div>
      )}

      {!carregou && !semConexao ? (
        <SkeletonMesas />
      ) : mesas.length === 0 ? (
        <div className="mx-auto max-w-sm rounded-xl border border-rico-wood/25 bg-white/80 p-10 text-center shadow-suave">
          <Armchair size={40} className="mx-auto text-rico-wood" />
          <p className="mt-3 font-bold text-carvao">Nenhuma mesa cadastrada</p>
          <p className="mt-1 text-sm font-semibold text-carvao-suave">
            {gerente
              ? 'Toque em "+ Mesa" ali em cima para montar o salão.'
              : 'Peça ao gerente para cadastrar as mesas.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {mesas.map((mesa) => (
            <MesaCard
              key={mesa.id}
              mesa={mesa}
              total={totalPorMesa.get(mesa.id) ?? 0}
              desde={desdePorMesa.get(mesa.id) ?? null}
              selecionada={mesa.id === mesaSelecionadaId}
              aoClicar={() => setMesaSelecionadaId(mesa.id)}
            />
          ))}
        </div>
      )}

      <SidebarConta
        mesa={mesaSelecionada}
        aoFechar={() => setMesaSelecionadaId(null)}
        aoAtualizar={recarregar}
        sessao={sessao}
      />
    </AppShell>
  );
}
