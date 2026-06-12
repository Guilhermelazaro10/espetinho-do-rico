import { useCallback, useEffect, useMemo, useState } from 'react';
import { WifiOff } from 'lucide-react';
import Layout from '../components/Layout';
import MesaCard from '../components/MesaCard';
import SidebarConta from '../components/SidebarConta';
import { api } from '../lib/api';
import { useAtualizacaoAoVivo } from '../hooks/useAtualizacaoAoVivo';

/*
 * Módulo Caixa — visão geral do salão (desktop).
 * Atualização em tempo real via SSE com polling de segurança;
 * só trafegam comandas em aberto (payload não cresce com o histórico).
 */
export default function Caixa({ sessao, aoSair }) {
  const [mesas, setMesas] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [mesaSelecionadaId, setMesaSelecionadaId] = useState(null);
  const [semConexao, setSemConexao] = useState(false);

  const recarregar = useCallback(async () => {
    try {
      const [m, p] = await Promise.all([api.mesas.listar(), api.pedidos.listarAbertos()]);
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

  // Comandas em aberto agrupadas por mesa (alimenta grid e sidebar)
  const pedidosPorMesa = useMemo(() => {
    const mapa = new Map();
    for (const pedido of pedidos) {
      const lista = mapa.get(pedido.mesaId) ?? [];
      lista.push(pedido);
      mapa.set(pedido.mesaId, lista);
    }
    return mapa;
  }, [pedidos]);

  const mesaSelecionada = mesas.find((m) => m.id === mesaSelecionadaId) ?? null;

  const resumo = useMemo(
    () => ({
      livres: mesas.filter((m) => m.status === 'livre').length,
      ocupadas: mesas.filter((m) => m.status === 'ocupada').length,
      fechando: mesas.filter((m) => m.status === 'fechando').length,
    }),
    [mesas]
  );

  const legenda = (
    <div className="flex items-center gap-4 text-xs font-bold text-carvao-claro">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-carvao/20" /> Livres · {resumo.livres}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-brasa" /> Ocupadas · {resumo.ocupadas}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-rico-red" /> Aguardando conta · {resumo.fechando}
      </span>
    </div>
  );

  return (
    <Layout acoes={legenda} sessao={sessao} aoSair={aoSair}>
      {semConexao && (
        <div
          className="mb-5 flex items-center gap-3 rounded-xl border-2 border-rico-red/30
            bg-rico-red/5 px-4 py-3 text-sm font-semibold text-rico-red"
          role="alert"
        >
          <WifiOff size={18} />
          Sem conexão com o servidor — tentando reconectar…
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {mesas.map((mesa) => {
          const abertos = pedidosPorMesa.get(mesa.id) ?? [];
          return (
            <MesaCard
              key={mesa.id}
              mesa={mesa}
              total={abertos.reduce((soma, p) => soma + p.total, 0)}
              selecionada={mesa.id === mesaSelecionadaId}
              aoClicar={() => setMesaSelecionadaId(mesa.id)}
            />
          );
        })}
      </div>

      <SidebarConta
        mesa={mesaSelecionada}
        pedidos={mesaSelecionada ? (pedidosPorMesa.get(mesaSelecionada.id) ?? []) : []}
        aoFechar={() => setMesaSelecionadaId(null)}
        aoAtualizar={recarregar}
        sessao={sessao}
      />
    </Layout>
  );
}
