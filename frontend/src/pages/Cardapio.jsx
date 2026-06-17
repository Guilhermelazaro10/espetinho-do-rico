import { useCallback, useEffect, useMemo, useState } from 'react';
import { Edit3, Eye, EyeOff, Plus, RefreshCw, RotateCcw, Save, Search, Trash2, UtensilsCrossed } from 'lucide-react';
import AppShell from '../components/AppShell';
import { api, moeda, paraCentavos } from '../lib/api';
import { notificar } from '../ui/toast';
import { confirmar } from '../lib/dialogos';

const FORM_INICIAL = { id: null, nome: '', categoria: '', preco: '' };

export default function Cardapio({ sessao, aoSair }) {
  const [produtos, setProdutos] = useState([]);
  const [form, setForm] = useState(FORM_INICIAL);
  const [busca, setBusca] = useState('');
  const [mostrarInativos, setMostrarInativos] = useState(true);
  const [carregando, setCarregando] = useState(false);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      setProdutos(await api.produtos.listar(true));
    } catch (e) {
      notificar.erro('Cardapio indisponivel', e.message);
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

  function editar(produto) {
    setForm({
      id: produto.id,
      nome: produto.nome,
      categoria: produto.categoria,
      preco: (produto.preco / 100).toFixed(2).replace('.', ','),
    });
  }

  async function salvar(e) {
    e.preventDefault();
    const corpo = {
      nome: form.nome,
      categoria: form.categoria,
      preco: paraCentavos(form.preco),
    };
    try {
      if (form.id) {
        await api.produtos.atualizar(form.id, corpo);
        notificar.sucesso('Produto atualizado', form.nome);
      } else {
        await api.produtos.criar(corpo);
        notificar.sucesso('Produto cadastrado', form.nome);
      }
      setForm(FORM_INICIAL);
      await recarregar();
    } catch (erro) {
      notificar.erro('Produto recusado', erro.message);
    }
  }

  async function desativar(produto) {
    const ok = await confirmar({
      titulo: `Inativar ${produto.nome}?`,
      mensagem: 'Ele some do cardapio, mas as vendas passadas continuam intactas.',
      confirmarRotulo: 'Inativar',
      perigo: true,
    });
    if (!ok) return;
    try {
      await api.produtos.desativar(produto.id);
      notificar.brasa('Produto inativado', 'Ele nao aparece mais para venda');
      await recarregar();
    } catch (e) {
      notificar.erro('Nao foi possivel inativar', e.message);
    }
  }

  async function reativar(produto) {
    try {
      await api.produtos.reativar(produto.id);
      notificar.sucesso('Produto reativado', produto.nome);
      await recarregar();
    } catch (e) {
      notificar.erro('Nao foi possivel reativar', e.message);
    }
  }

  const acoes = (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setMostrarInativos((valor) => !valor)}
        className="rounded-lg bg-white p-2 text-carvao shadow-suave ring-1 ring-carvao/10"
        aria-label={mostrarInativos ? 'Ocultar inativos' : 'Mostrar inativos'}
        title={mostrarInativos ? 'Ocultar inativos' : 'Mostrar inativos'}
      >
        {mostrarInativos ? <Eye size={17} /> : <EyeOff size={17} />}
      </button>
      <button
        onClick={recarregar}
        className="rounded-lg bg-carvao p-2 text-rico-light transition hover:bg-carvao-claro"
        aria-label="Atualizar cardapio"
        title="Atualizar"
      >
        <RefreshCw size={17} className={carregando ? 'animate-spin' : ''} />
      </button>
    </div>
  );

  return (
    <AppShell titulo="Cardapio" acoes={acoes} sessao={sessao} aoSair={aoSair}>
      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="space-y-4">
          <form onSubmit={salvar} className="rounded-xl bg-rico-dark p-5 text-rico-light shadow-media">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-rico-light/70">
              <UtensilsCrossed size={16} className="text-rico-wood" /> {form.id ? 'Editar produto' : 'Novo produto'}
            </h2>
            <div className="mt-4 space-y-3">
              <Campo rotulo="Nome" valor={form.nome} onChange={(v) => alterar('nome', v)} required />
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rico-light/50">Categoria</span>
                <input
                  value={form.categoria}
                  onChange={(e) => alterar('categoria', e.target.value)}
                  list="categorias-cardapio"
                className="mt-1 w-full rounded-lg bg-rico-light px-3 py-2 text-sm font-semibold text-carvao outline-none ring-1 ring-rico-wood/30 focus:ring-rico-red"
                  required
                />
                <datalist id="categorias-cardapio">
                  {categorias.map((categoria) => (
                    <option key={categoria} value={categoria} />
                  ))}
                </datalist>
              </label>
              <Campo rotulo="Preco" valor={form.preco} onChange={(v) => alterar('preco', v)} required />
            </div>
            <div className="mt-4 flex gap-2">
              <button className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-rico-red font-bold text-rico-light shadow-brasa transition hover:-translate-y-0.5 active:translate-y-0">
                {form.id ? <Save size={17} /> : <Plus size={17} />} Salvar
              </button>
              {form.id && (
                <button
                  type="button"
                  onClick={() => setForm(FORM_INICIAL)}
                  className="rounded-xl bg-rico-light/10 px-4 font-bold text-rico-light"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>

          <div className="rounded-xl bg-white/80 p-4 shadow-suave ring-1 ring-rico-wood/25">
            <label className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 ring-1 ring-rico-wood/35">
              <Search size={16} className="text-carvao-suave" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar item"
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-carvao outline-none placeholder:text-carvao-suave"
              />
            </label>
          </div>
        </section>

        <section className="grid content-start gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {filtrados.map((produto) => (
            <article
              key={produto.id}
              className={`rounded-xl border border-rico-wood/25 bg-white/82 p-4 shadow-suave ring-1 ring-rico-wood/10 transition hover:-translate-y-0.5 hover:shadow-media ${
                produto.ativo ? '' : 'opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold text-carvao">{produto.nome}</p>
                  <p className="text-sm font-semibold text-carvao-suave">{produto.categoria}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                  produto.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-carvao/10 text-carvao-suave'
                }`}>
                  {produto.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <p className="mt-4 font-display text-3xl text-rico-red">{moeda(produto.preco)}</p>
              <div className="mt-4 flex items-center justify-end gap-2 border-t border-rico-wood/25 pt-3">
                <button
                  onClick={() => editar(produto)}
                  className="rounded-lg bg-carvao px-3 py-2 text-xs font-bold text-rico-light"
                >
                  <Edit3 size={14} className="inline" /> Editar
                </button>
                {produto.ativo ? (
                  <button
                    onClick={() => desativar(produto)}
                    className="rounded-lg p-2 text-rico-red hover:bg-rico-red/10"
                    aria-label="Inativar"
                    title="Inativar"
                  >
                    <Trash2 size={16} />
                  </button>
                ) : (
                  <button
                    onClick={() => reativar(produto)}
                    className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-100"
                    aria-label="Reativar"
                    title="Reativar"
                  >
                    <RotateCcw size={16} />
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>
      </div>
    </AppShell>
  );
}

function Campo({ rotulo, valor, onChange, required = false }) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold uppercase tracking-wider text-rico-light/50">{rotulo}</span>
      <input
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="mt-1 w-full rounded-lg bg-rico-light px-3 py-2 text-sm font-semibold text-carvao outline-none ring-1 ring-rico-wood/30 focus:ring-rico-red"
      />
    </label>
  );
}
