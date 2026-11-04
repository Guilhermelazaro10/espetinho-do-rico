import { useCallback, useEffect, useState } from 'react';
import { Flame, ChefHat, CheckCheck, Timer, ArrowLeft, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';
import { minutosDesde } from '../lib/datas';
import { notificar, ToasterGlobal } from '../ui/toast';
import { useAtualizacaoAoVivo } from '../hooks/useAtualizacaoAoVivo';
import { useMediaQuery } from '../hooks/useMediaQuery';

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

  // A chapa trabalha por ordem de chegada: o mais antigo primeiro. A API
  // devolve do mais novo para o mais antigo (criadoEm desc), por isso reordena.
  const porChegada = (a, b) => new Date(a.criadoEm) - new Date(b.criadoEm);
  const naFila = pedidos.filter((p) => p.status === 'aberto').sort(porChegada);
  const naChapa = pedidos.filter((p) => p.status === 'em_preparo').sort(porChegada);

  // 1280px+: três colunas — fila, na chapa e o transbordo da fila (a fila longa
  // continua na terceira coluna em vez de empurrar a tela para baixo).
  const tresColunas = useMediaQuery('(min-width: 1280px)');
  const metade = Math.ceil(naFila.length / 2);
  const filaPrincipal = tresColunas && naFila.length > 1 ? naFila.slice(0, metade) : naFila;
  const filaTransbordo = tresColunas && naFila.length > 1 ? naFila.slice(metade) : [];

  return (
    <div className="min-h-dvh bg-carvao text-rico-light">
      <ToasterGlobal />

      <header className="safe-area-header-top sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-creme/10 bg-carvao px-4 pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <ChefHat size={20} className="shrink-0 text-brasa-clara" aria-hidden="true" />
          <h1 className="font-display text-lg leading-none"><span className="sr-only sm:not-sr-only">Espetinho do Rico</span></h1>
          <span className="shrink-0 rounded-full bg-rico-red px-2.5 py-0.5 text-xs font-bold text-white">Cozinha</span>
        </div>
        <a
          href="#/"
          className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-rico-light/80 transition-colors hover:bg-rico-light/10 hover:text-rico-light"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Caixa
        </a>
      </header>

      <main className="safe-area-kds-bottom mx-auto grid max-w-6xl grid-cols-1 gap-6 p-4 md:grid-cols-2 xl:max-w-[1440px] xl:grid-cols-3 xl:p-6">
        <Coluna
          titulo={`Na fila · ${naFila.length}`}
          vazio="Nenhum pedido aguardando"
          pedidos={filaPrincipal}
          rotuloAcao="Iniciar preparo"
          IconeAcao={Flame}
          corBotao="bg-rico-red text-white hover:bg-vinho-profundo"
          aoAgir={avancar}
        />
        <Coluna
          titulo={`Na chapa · ${naChapa.length}`}
          vazio="Nada na chapa agora"
          pedidos={naChapa}
          rotuloAcao="Marcar entregue"
          IconeAcao={CheckCheck}
          corBotao="bg-creme text-carvao hover:bg-white"
          aoAgir={avancar}
        />
        {tresColunas && (
          <Coluna
            titulo="Na fila · continuação"
            vazio="A fila cabe na primeira coluna"
            pedidos={filaTransbordo}
            rotuloAcao="Iniciar preparo"
            IconeAcao={Flame}
            corBotao="bg-rico-red text-white hover:bg-vinho-profundo"
            aoAgir={avancar}
          />
        )}
      </main>
    </div>
  );
}

// Título do ticket por canal: mesa, delivery ou balcão (delivery/balcão não têm mesa)
export function tituloPedido(pedido) {
  if (pedido.tipo === 'DELIVERY') return `Delivery${pedido.clienteNome ? ` · ${pedido.clienteNome}` : ''}`;
  if (pedido.tipo === 'BALCAO') return `Balcão${pedido.clienteNome ? ` · ${pedido.clienteNome}` : ''}`;
  return `Mesa ${String(pedido.mesa?.numero ?? pedido.mesaId ?? '?').padStart(2, '0')}`;
}

function Coluna({ titulo, vazio, pedidos, rotuloAcao, IconeAcao, corBotao, aoAgir }) {
  return (
    <section aria-label={titulo} className="min-w-0">
      <h2 className="mb-3 text-sm font-semibold text-rico-light/80 tabular-nums">{titulo}</h2>
      {pedidos.length === 0 ? (
        <p className="rounded-2xl bg-rico-light/5 px-4 py-8 text-center text-sm text-rico-light/70 ring-1 ring-rico-light/10">
          {vazio}
        </p>
      ) : (
        <ul className="space-y-3">
          {pedidos.map((pedido) => {
            const minutos = minutosDesde(pedido.criadoEm);
            return (
              <li key={pedido.id} className="animate-card-entrada rounded-2xl bg-rico-light/6 p-4 ring-1 ring-rico-light/10 md:p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 break-words font-display text-2xl leading-tight">{tituloPedido(pedido)}</h3>
                  {/* Tempo de espera: nunca quebra linha */}
                  <span
                    className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-sm font-bold tabular-nums ${
                      minutos >= 15
                        ? 'bg-rico-red text-white'
                        : minutos >= 8
                          ? 'bg-atencao text-white'
                          : 'bg-rico-light/12 text-rico-light/85'
                    }`}
                  >
                    <Timer size={14} aria-hidden="true" /> {minutos} min
                  </span>
                </div>
                {pedido.pagoAntecipado && (
                  <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-ok-claro/18 px-2.5 py-1 text-xs font-bold text-ok-claro">
                    <CheckCheck size={13} aria-hidden="true" /> Pago · venda rápida
                  </span>
                )}
                <ul className="mt-3 space-y-2">
                  {pedido.itens.map((item) => (
                    <li key={item.id} className="break-words text-base leading-snug md:text-xl">
                      <span className="mr-1.5 inline-block min-w-[2ch] rounded-md bg-brasa-clara/18 px-1.5 font-extrabold text-brasa-clara tabular-nums">
                        {item.quantidade}×
                      </span>
                      <span className="font-semibold">{item.produto.nome}</span>
                      {item.observacao && (
                        <p className="mt-1 flex items-start gap-1.5 rounded-lg bg-atencao/25 px-2 py-1 text-base font-bold text-brasa-clara md:text-xl">
                          <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" /> {item.observacao}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => aoAgir(pedido)}
                  className={`mt-4 flex min-h-13 w-full items-center justify-center gap-2 rounded-xl text-base font-bold transition-colors ${corBotao}`}
                >
                  <IconeAcao size={20} aria-hidden="true" /> {rotuloAcao}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
