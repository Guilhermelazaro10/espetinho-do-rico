import { useCallback, useEffect, useMemo, useState } from 'react';
import { WifiOff, Plus } from 'lucide-react';
import AppShell from '../components/AppShell';
import MesaCard from '../components/MesaCard';
import SidebarConta from '../components/SidebarConta';
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

  const recarregar = useCallback(async () => {
    try {
      const [m, p] = await Promise.all([
        api.mesas.listar(),
        api.pedidos.listarAbertos(TIPOS_PEDIDO.MESA),
      ]);
      setMesas(m);
      setPedidos(p);
      setSemConexao(false);
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
      <div className="hidden items-center gap-4 text-xs font-bold text-carvao-claro sm:flex">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Livres · {resumo.livres}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rico-red" /> Ocupadas · {resumo.ocupadas}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rico-wood" /> Aguardando · {resumo.aguardando}
        </span>
      </div>
      {gerente && (
        <button
          onClick={adicionarMesa}
          className="flex items-center gap-1.5 rounded-lg bg-rico-red px-3 py-2 text-xs font-bold text-rico-light shadow-brasa transition hover:-translate-y-0.5 active:translate-y-0"
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

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {mesas.map((mesa) => (
          <MesaCard
            key={mesa.id}
            mesa={mesa}
            total={totalPorMesa.get(mesa.id) ?? 0}
            selecionada={mesa.id === mesaSelecionadaId}
            aoClicar={() => setMesaSelecionadaId(mesa.id)}
          />
        ))}
      </div>

      <SidebarConta
        mesa={mesaSelecionada}
        aoFechar={() => setMesaSelecionadaId(null)}
        aoAtualizar={recarregar}
        sessao={sessao}
      />
    </AppShell>
  );
}
