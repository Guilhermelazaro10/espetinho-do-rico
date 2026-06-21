import { useCallback, useEffect, useState } from 'react';
import { Flame, ChefHat, CheckCheck, Timer, ArrowLeft, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';
import { notificar, ToasterGlobal } from '../ui/toast';
import { useAtualizacaoAoVivo } from '../hooks/useAtualizacaoAoVivo';

/*
 * KDS — tela da chapa (cozinha). Dark mode, cards grandes, leitura à distância.
 * Fluxo: Na fila (aberto) → Na chapa (em_preparo) → Entregue.
 */
export default function Cozinha() {
  const [pedidos, setPedidos] = useState([]);

  const recarregar = useCallback(async () => {
    try {
      const todos = await api.pedidos.listarAbertos();
      setPedidos(todos.filter((p) => ['aberto', 'em_preparo'].includes(p.status)));
    } catch {
      /* banner de conexão fica a cargo do caixa; aqui só mantém o último estado */
    }
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);
  useAtualizacaoAoVivo(recarregar);

  async function avancar(pedido) {
    const proximo = pedido.status === 'aberto' ? 'em_preparo' : 'entregue';
    const ref = tituloPedido(pedido);
    try {
      await api.pedidos.atualizarStatus(pedido.id, proximo);
      if (proximo === 'entregue') {
        notificar.sucesso(`${ref} pronto`, `Comanda #${pedido.id} entregue`);
      } else {
        notificar.brasa('Na chapa!', `Comanda #${pedido.id} · ${ref}`);
      }
      await recarregar();
    } catch (e) {
      notificar.erro('Não foi possível atualizar', e.message);
      await recarregar();
    }
  }

  const naFila = pedidos.filter((p) => p.status === 'aberto');
  const naChapa = pedidos.filter((p) => p.status === 'em_preparo');

  return (
    <div className="min-h-dvh bg-carvao text-rico-light">
      <ToasterGlobal />

      <header className="safe-area-header-top sticky top-0 z-20 flex items-center justify-between border-b border-creme/10 bg-carvao/95 px-4 pb-3 backdrop-blur">
        <div className="flex min-w-0 items-center gap-2">
          <ChefHat size={18} className="text-brasa-clara" />
          <span className="truncate font-display text-lg leading-none">Espetinho do Rico</span>
          <span className="rounded-full bg-brasa-gradiente px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            Cozinha
          </span>
        </div>
        <a
          href="#/"
          className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-rico-light/65 transition hover:bg-rico-light/10 hover:text-rico-light active:scale-95"
        >
          <ArrowLeft size={14} /> Caixa
        </a>
      </header>

      <main className="safe-area-kds-bottom mx-auto grid max-w-6xl gap-6 p-4 md:grid-cols-2">
        <Coluna
          titulo={`Na fila · ${naFila.length}`}
          vazio="Nenhum pedido aguardando"
          pedidos={naFila}
          rotuloAcao="Iniciar preparo"
          IconeAcao={Flame}
          corBotao="bg-brasa-gradiente text-white shadow-brasa"
          aoAgir={avancar}
        />
        <Coluna
          titulo={`Na chapa · ${naChapa.length}`}
          vazio="Nada na chapa agora"
          pedidos={naChapa}
          rotuloAcao="Marcar entregue"
          IconeAcao={CheckCheck}
          corBotao="bg-rico-red text-rico-light"
          aoAgir={avancar}
        />
      </main>
    </div>
  );
}

function minutosDesde(data) {
  return Math.max(0, Math.round((Date.now() - new Date(data).getTime()) / 60000));
}

// Título do ticket por canal: mesa, delivery ou balcão (delivery/balcão não têm mesa)
export function tituloPedido(pedido) {
  if (pedido.tipo === 'DELIVERY') return `Delivery${pedido.clienteNome ? ` · ${pedido.clienteNome}` : ''}`;
  if (pedido.tipo === 'BALCAO') return `Balcão${pedido.clienteNome ? ` · ${pedido.clienteNome}` : ''}`;
  return `Mesa ${String(pedido.mesa?.numero ?? pedido.mesaId ?? '?').padStart(2, '0')}`;
}

function Coluna({ titulo, vazio, pedidos, rotuloAcao, IconeAcao, corBotao, aoAgir }) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-rico-light/50">
        {titulo}
      </h2>
      {pedidos.length === 0 ? (
        <p className="rounded-xl bg-rico-light/5 px-4 py-8 text-center text-sm text-rico-light/40 ring-1 ring-rico-light/10">
          {vazio}
        </p>
      ) : (
        <ul className="space-y-3">
          {pedidos.map((pedido) => {
            const minutos = minutosDesde(pedido.criadoEm);
            return (
              <li key={pedido.id} className="rounded-xl bg-rico-light/5 p-4 ring-1 ring-rico-light/10">
                <div className="flex items-center justify-between">
                  <span className="font-display text-2xl">
                    {tituloPedido(pedido)}
                  </span>
                  <span
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                      minutos >= 15
                        ? 'bg-rico-red text-rico-light'
                        : minutos >= 8
                          ? 'bg-brasa-gradiente text-white'
                          : 'bg-rico-light/10 text-rico-light/60'
                    }`}
                  >
                    <Timer size={12} /> {minutos} min
                  </span>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {pedido.itens.map((item) => (
                    <li key={item.id} className="text-sm">
                      <span className="font-bold text-brasa-clara">{item.quantidade}×</span>{' '}
                      <span className="font-semibold">{item.produto.nome}</span>
                      {item.observacao && (
                        <p className="ml-5 flex items-center gap-1 text-[13px] font-bold uppercase tracking-wide text-brasa-clara">
                          <AlertTriangle size={13} className="shrink-0" /> {item.observacao}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => aoAgir(pedido)}
                  className={`mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl
                    text-sm font-bold transition active:scale-[0.98] ${corBotao}`}
                >
                  <IconeAcao size={18} /> {rotuloAcao}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
