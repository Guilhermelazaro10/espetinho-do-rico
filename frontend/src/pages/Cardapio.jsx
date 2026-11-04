import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Edit3, Ellipsis, Eye, EyeOff, Plus, RefreshCw, RotateCcw, Save, Search } from 'lucide-react';
import AppShell from '../components/AppShell';
import { api, moeda, paraCentavos } from '../lib/api';
import { notificar } from '../ui/toast';
import { confirmar } from '../lib/dialogos';
import CampoBase from '../ui/Campo';
import AcaoTopo from '../ui/AcaoTopo';
import Botao from '../ui/Botao';
import Selo from '../ui/Selo';
import Sheet from '../ui/Sheet';

const FORM_INICIAL = { id: null, nome: '', categoria: '', preco: '' };

export default function Cardapio({ sessao, aoSair }) {
  const [produtos, setProdutos] = useState([]);
  const [form, setForm] = useState(FORM_INICIAL);
  const [formAberto, setFormAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [mostrarInativos, setMostrarInativos] = useState(true);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      setProdutos(await api.produtos.listar(true));
    } catch (e) {
      notificar.erro('Cardápio indisponível', e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  const categorias = useMemo(
    () => [...new Set(produtos.map((produto) => produto.categoria))].filter(Boolean),
    [produtos]
  );

  const filtrados = produtos.filter((produto) => {
    const texto = `${produto.nome} ${produto.categoria}`.toLowerCase();
    return texto.includes(busca.toLowerCase()) && (mostrarInativos || produto.ativo);
  });

  function alterar(campo, valor) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }

  function novo() {
    setForm(FORM_INICIAL);
    setFormAberto(true);
  }

  function editar(produto) {
    setForm({
      id: produto.id,
      nome: produto.nome,
      categoria: produto.categoria,
      preco: (produto.preco / 100).toFixed(2).replace('.', ','),
    });
    setFormAberto(true);
  }

  async function salvar(e) {
    e.preventDefault();
    const corpo = {
      nome: form.nome,
      categoria: form.categoria,
      preco: paraCentavos(form.preco),
    };
    setSalvando(true);
    try {
      if (form.id) {
        await api.produtos.atualizar(form.id, corpo);
        notificar.sucesso('Produto atualizado', form.nome);
      } else {
        await api.produtos.criar(corpo);
        notificar.sucesso('Produto cadastrado', form.nome);
      }
      setForm(FORM_INICIAL);
      setFormAberto(false);
      await recarregar();
    } catch (erro) {
      notificar.erro('Produto recusado', erro.message);
    } finally {
      setSalvando(false);
    }
  }

  async function desativar(produto) {
    const ok = await confirmar({
      titulo: `Marcar ${produto.nome} como esgotado?`,
      mensagem: 'Some na hora do cardápio online e da tela dos garçons. É só reativar quando voltar a ter.',
      confirmarRotulo: 'Esgotou',
    });
    if (!ok) return;
    try {
      await api.produtos.desativar(produto.id);
      notificar.brasa('Marcado como esgotado', 'Sumiu do cardápio online e dos garçons');
      await recarregar();
    } catch (e) {
      notificar.erro('Não foi possível esgotar', e.message);
    }
  }

  async function reativar(produto) {
    try {
      await api.produtos.reativar(produto.id);
      notificar.sucesso('Disponível de novo', produto.nome);
      await recarregar();
    } catch (e) {
      notificar.erro('Não foi possível reativar', e.message);
    }
  }

  const acoes = (
    <div className="flex items-center gap-2">
      <AcaoTopo
        icone={mostrarInativos ? Eye : EyeOff}
        rotulo={mostrarInativos ? 'Ocultar inativos' : 'Mostrar inativos'}
        aria-pressed={mostrarInativos}
        onClick={() => setMostrarInativos((valor) => !valor)}
      />
      <AcaoTopo icone={RefreshCw} rotulo="Atualizar cardápio" variante="escura" girando={carregando} onClick={recarregar} />
    </div>
  );

  return (
    <AppShell titulo="Cardápio" acoes={acoes} sessao={sessao} aoSair={aoSair}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg bg-white px-3 ring-1 ring-inset ring-rico-wood/45 focus-within:ring-2 focus-within:ring-rico-red sm:max-w-sm">
          <Search size={18} className="shrink-0 text-carvao-suave" aria-hidden="true" />
          <span className="sr-only">Buscar item</span>
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar item"
            className="min-w-0 flex-1 bg-transparent text-sm text-carvao outline-none"
          />
        </label>
        <Botao icone={Plus} onClick={novo} className="sm:ml-auto">
          Novo produto
        </Botao>
      </div>

      {/* Celular: linhas compactas com menu de ações */}
      <ul className="mt-4 divide-y divide-creme-escuro overflow-hidden rounded-2xl border border-rico-wood/30 bg-white md:hidden">
        {filtrados.map((produto) => (
          <li key={produto.id} className="flex min-h-[72px] items-center gap-3 py-2.5 pl-4 pr-2">
            <div className="min-w-0 flex-1">
              <p
                data-nome-produto
                className={`line-clamp-2 text-sm font-semibold leading-snug ${produto.ativo ? 'text-carvao' : 'text-carvao-suave'}`}
              >
                {produto.nome}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-rotulo text-carvao-suave">
                <span>{produto.categoria}</span>
                <span className="font-bold text-carvao tabular-nums">{moeda(produto.preco)}</span>
                {!produto.ativo && <Selo tom="atencao">Esgotado</Selo>}
              </p>
            </div>
            <MenuAcoes produto={produto} aoEditar={editar} aoEsgotar={desativar} aoReativar={reativar} />
          </li>
        ))}
        {filtrados.length === 0 && <Vazio busca={busca} />}
      </ul>

      {/* Tablet/desktop: grade de cards, nome sempre inteiro */}
      <section className="mt-4 hidden grid-cols-2 content-start gap-3 md:grid xl:grid-cols-3 2xl:grid-cols-4">
        {filtrados.map((produto) => (
          <article key={produto.id} className="flex flex-col rounded-2xl border border-rico-wood/30 bg-white p-4 shadow-suave">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p
                  data-nome-produto
                  className={`break-words text-base font-bold leading-snug ${produto.ativo ? 'text-carvao' : 'text-carvao-suave'}`}
                >
                  {produto.nome}
                </p>
                <p className="text-rotulo text-carvao-suave">{produto.categoria}</p>
              </div>
              <Selo tom={produto.ativo ? 'ok' : 'atencao'}>{produto.ativo ? 'Disponível' : 'Esgotado'}</Selo>
            </div>
            <p className="mt-3 text-lg font-bold text-rico-red tabular-nums">{moeda(produto.preco)}</p>
            <div className="mt-auto flex items-center justify-end gap-2 border-t border-creme-escuro pt-3">
              <Botao variante="secundario" icone={Edit3} onClick={() => editar(produto)}>
                Editar
              </Botao>
              {produto.ativo ? (
                <Botao
                  variante="perigo"
                  icone={EyeOff}
                  onClick={() => desativar(produto)}
                  title="Marcar como esgotado (some do cardápio e dos garçons)"
                >
                  Esgotou
                </Botao>
              ) : (
                <Botao variante="secundario" icone={RotateCcw} onClick={() => reativar(produto)} title="Voltar a vender">
                  Disponibilizar
                </Botao>
              )}
            </div>
          </article>
        ))}
        {filtrados.length === 0 && (
          <div className="col-span-full rounded-2xl border border-rico-wood/30 bg-white">
            <Vazio busca={busca} />
          </div>
        )}
      </section>

      <Sheet
        aberto={formAberto}
        aoFechar={() => setFormAberto(false)}
        titulo={form.id ? 'Editar produto' : 'Novo produto'}
        rodape={
          <Botao type="submit" form="form-produto" tamanho="lg" icone={form.id ? Save : Plus} carregando={salvando} className="w-full">
            Salvar
          </Botao>
        }
      >
        <form id="form-produto" onSubmit={salvar} className="space-y-4">
          <CampoBase rotulo="Nome" value={form.nome} onChange={(e) => alterar('nome', e.target.value)} required autoComplete="off" />
          <CampoBase
            rotulo="Categoria"
            value={form.categoria}
            onChange={(e) => alterar('categoria', e.target.value)}
            list="categorias-cardapio"
            dica="Escolha uma existente ou digite uma nova."
            required
            autoComplete="off"
          />
          <datalist id="categorias-cardapio">
            {categorias.map((categoria) => (
              <option key={categoria} value={categoria} />
            ))}
          </datalist>
          <CampoBase
            rotulo="Preço (R$)"
            value={form.preco}
            onChange={(e) => alterar('preco', e.target.value)}
            inputMode="decimal"
            placeholder="ex.: 7,00"
            required
          />
        </form>
      </Sheet>
    </AppShell>
  );
}

function Vazio({ busca }) {
  return (
    <p className="px-4 py-8 text-center text-sm text-carvao-suave">
      {busca.trim() ? `Nenhum item encontrado para “${busca.trim()}”.` : 'Nenhum produto cadastrado.'}
    </p>
  );
}

// Menu "⋯" da linha no celular: Editar e Esgotou/Disponibilizar.
// Abre para a esquerda (nunca sai da tela), fecha com Esc ou toque fora.
function MenuAcoes({ produto, aoEditar, aoEsgotar, aoReativar }) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef(null);
  const gatilho = useRef(null);

  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => {
      if (!raiz.current?.contains(e.target)) setAberto(false);
    };
    const tecla = (e) => {
      if (e.key === 'Escape') {
        setAberto(false);
        gatilho.current?.focus();
      }
    };
    document.addEventListener('pointerdown', fora);
    document.addEventListener('keydown', tecla);
    raiz.current?.querySelector('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener('pointerdown', fora);
      document.removeEventListener('keydown', tecla);
    };
  }, [aberto]);

  const item = 'flex min-h-11 w-full items-center gap-2 px-4 text-left text-sm font-semibold hover:bg-creme-escuro focus:bg-creme-escuro focus:outline-none';
  const escolher = (acao) => () => {
    setAberto(false);
    acao(produto);
  };

  return (
    <div ref={raiz} className="relative shrink-0">
      <button
        ref={gatilho}
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label={`Ações de ${produto.nome}`}
        className="grid h-11 w-11 place-items-center rounded-lg text-carvao-claro hover:bg-carvao/6"
      >
        <Ellipsis size={20} aria-hidden="true" />
      </button>
      {aberto && (
        <div
          role="menu"
          aria-label={`Ações de ${produto.nome}`}
          className="absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-xl border border-rico-wood/30 bg-white py-1 shadow-media"
        >
          <button type="button" role="menuitem" onClick={escolher(aoEditar)} className={`${item} text-carvao`}>
            <Edit3 size={16} aria-hidden="true" /> Editar
          </button>
          {produto.ativo ? (
            <button type="button" role="menuitem" onClick={escolher(aoEsgotar)} className={`${item} text-rico-red`}>
              <EyeOff size={16} aria-hidden="true" /> Esgotou
            </button>
          ) : (
            <button type="button" role="menuitem" onClick={escolher(aoReativar)} className={`${item} text-ok`}>
              <RotateCcw size={16} aria-hidden="true" /> Disponibilizar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
