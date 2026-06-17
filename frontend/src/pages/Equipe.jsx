import { useCallback, useEffect, useState } from 'react';
import {
  Copy, ExternalLink, KeyRound, Plus, RefreshCw, Share2, ShieldCheck,
  Smartphone, UserMinus, Users, Wifi,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import { api } from '../lib/api';
import { PAPEIS } from '../lib/constantes';
import { notificar } from '../ui/toast';
import { confirmar } from '../lib/dialogos';

export default function Equipe({ sessao, aoSair }) {
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState({ nome: '', papel: PAPEIS.GARCOM, tamanhoPin: 4 });
  const [pinGerado, setPinGerado] = useState(null);
  const [rede, setRede] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [trocaPin, setTrocaPin] = useState({ atual: '', novo: '' });

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [lista, redeAtual] = await Promise.all([
        api.usuarios.listar(),
        api.rede.info(),
      ]);
      setUsuarios(lista);
      setRede(redeAtual);
    } catch (e) {
      notificar.erro('Equipe indisponivel', e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  function alterar(campo, valor) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }

  async function trocarMeuPin(e) {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(trocaPin.novo)) {
      notificar.erro('PIN invalido', 'O novo PIN deve ter de 4 a 6 digitos');
      return;
    }
    try {
      await api.perfil.trocarPin({ pinAtual: trocaPin.atual, pinNovo: trocaPin.novo });
      setTrocaPin({ atual: '', novo: '' });
      notificar.sucesso('PIN alterado', 'Use o novo PIN no proximo login');
    } catch (erro) {
      notificar.erro('Nao foi possivel trocar', erro.message);
    }
  }

  async function cadastrar(e) {
    e.preventDefault();
    try {
      const criado = await api.usuarios.criar({
        nome: form.nome,
        papel: form.papel,
        tamanhoPin: Number(form.tamanhoPin),
      });
      setPinGerado(criado);
      setForm({ nome: '', papel: PAPEIS.GARCOM, tamanhoPin: 4 });
      notificar.sucesso('Funcionario cadastrado', `PIN ${criado.pin}`);
      await recarregar();
    } catch (erro) {
      notificar.erro('Cadastro recusado', erro.message);
    }
  }

  async function novoPin(usuario) {
    try {
      const resposta = await api.usuarios.novoPin(usuario.id);
      setPinGerado({ ...usuario, pin: resposta.pin });
      notificar.brasa('Novo PIN gerado', `${usuario.nome}: ${resposta.pin}`);
    } catch (e) {
      notificar.erro('PIN nao gerado', e.message);
    }
  }

  async function desligar(usuario) {
    const ok = await confirmar({
      titulo: `Desligar ${usuario.nome}?`,
      mensagem: 'O PIN e revogado na hora. O historico do funcionario e preservado.',
      confirmarRotulo: 'Desligar',
      perigo: true,
    });
    if (!ok) return;
    try {
      await api.usuarios.desligar(usuario.id);
      notificar.sucesso('Funcionario desligado', usuario.nome);
      await recarregar();
    } catch (e) {
      notificar.erro('Desligamento recusado', e.message);
    }
  }

  async function copiarLinkGarcom() {
    const link = rede?.urlPreferencialGarcom;
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      notificar.sucesso('Link copiado', 'Envie para os garcons pelo WhatsApp');
    } catch {
      notificar.erro('Nao foi possivel copiar', link);
    }
  }

  async function compartilharLinkGarcom() {
    const link = rede?.urlPreferencialGarcom;
    if (!link) return;
    const texto = `Acesso Garcom - Espetinho do Rico: ${link}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Acesso Garcom', text: texto, url: link });
        return;
      } catch {
        return;
      }
    }
    await copiarLinkGarcom();
  }

  const ativos = usuarios.filter((usuario) => usuario.ativo).length;

  const acoes = (
    <button
      onClick={recarregar}
      className="rounded-lg bg-carvao p-2 text-rico-light transition hover:bg-carvao-claro"
      aria-label="Atualizar equipe"
      title="Atualizar"
    >
      <RefreshCw size={17} className={carregando ? 'animate-spin' : ''} />
    </button>
  );

  return (
    <AppShell titulo="Equipe" acoes={acoes} sessao={sessao} aoSair={aoSair}>
      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="space-y-4">
          <div className="rounded-xl border border-rico-wood/25 bg-white/85 p-5 shadow-media ring-1 ring-rico-wood/10">
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-rico-red/10 p-3 text-rico-red">
                <Smartphone size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold uppercase tracking-wider text-rico-dark">
                  Acesso dos garcons
                </h2>
                <p className="mt-1 text-sm font-semibold text-carvao-suave">
                  Link atual para celulares na mesma rede Wi-Fi do caixa.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-rico-dark p-3 text-rico-light">
              <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-rico-wood">
                <Wifi size={14} /> Rede atual
              </p>
              <p className="mt-1 break-all text-sm font-bold">
                {rede?.urlPreferencialGarcom ?? 'Detectando rede local...'}
              </p>
              {rede?.nomeComputador && (
                <p className="mt-1 text-xs font-semibold text-rico-light/45">
                  {rede.nomeComputador} - porta {rede.porta}
                </p>
              )}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={copiarLinkGarcom}
                disabled={!rede?.urlPreferencialGarcom}
                className="flex h-12 items-center justify-center gap-2 rounded-xl bg-rico-red text-sm font-bold text-rico-light shadow-brasa transition active:scale-[0.98] disabled:opacity-40"
              >
                <Copy size={17} /> Copiar
              </button>
              <button
                type="button"
                onClick={compartilharLinkGarcom}
                disabled={!rede?.urlPreferencialGarcom}
                className="flex h-12 items-center justify-center gap-2 rounded-xl border border-rico-wood/45 bg-white text-sm font-bold text-rico-dark transition active:scale-[0.98] disabled:opacity-40"
              >
                <Share2 size={17} /> Enviar
              </button>
            </div>

            <a
              href={rede?.urlPreferencialGarcom ?? '#/garcom'}
              className="mt-2 flex h-11 items-center justify-center gap-2 rounded-xl bg-rico-wood/14 text-sm font-bold text-rico-dark ring-1 ring-rico-wood/30"
            >
              <ExternalLink size={16} /> Abrir modo garcom
            </a>
          </div>

          <form onSubmit={cadastrar} className="rounded-xl bg-rico-dark p-5 text-rico-light shadow-media">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-rico-light/70">
              <Users size={16} /> Novo funcionario
            </h2>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rico-light/50">Nome</span>
                <input
                  value={form.nome}
                  onChange={(e) => alterar('nome', e.target.value)}
                  className="mt-1 w-full rounded-lg bg-rico-light px-3 py-2 text-sm font-semibold text-carvao outline-none ring-1 ring-rico-wood/30 focus:ring-rico-red"
                  required
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rico-light/50">Papel</span>
                <select
                  value={form.papel}
                  onChange={(e) => alterar('papel', e.target.value)}
                  className="mt-1 w-full rounded-lg bg-rico-light px-3 py-2 text-sm font-semibold text-carvao outline-none ring-1 ring-rico-wood/30 focus:ring-rico-red"
                >
                  <option value={PAPEIS.GARCOM}>Garcom</option>
                  <option value={PAPEIS.GERENTE}>Gerente</option>
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rico-light/50">Digitos do PIN</span>
                <select
                  value={form.tamanhoPin}
                  onChange={(e) => alterar('tamanhoPin', e.target.value)}
                  className="mt-1 w-full rounded-lg bg-rico-light px-3 py-2 text-sm font-semibold text-carvao outline-none ring-1 ring-rico-wood/30 focus:ring-rico-red"
                >
                  <option value={4}>4 digitos</option>
                  <option value={5}>5 digitos</option>
                  <option value={6}>6 digitos</option>
                </select>
              </label>
            </div>
            <button className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-rico-red font-bold text-rico-light shadow-brasa transition hover:-translate-y-0.5 active:translate-y-0">
              <Plus size={17} /> Cadastrar
            </button>
          </form>

          <form onSubmit={trocarMeuPin} className="rounded-xl border border-rico-wood/25 bg-white/85 p-5 shadow-suave ring-1 ring-rico-wood/10">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-rico-dark">
              <KeyRound size={16} className="text-rico-red" /> Trocar meu PIN
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <input
                value={trocaPin.atual}
                onChange={(e) => setTrocaPin((p) => ({ ...p, atual: e.target.value.replace(/\D/g, '') }))}
                placeholder="PIN atual"
                inputMode="numeric"
                maxLength={6}
                className="rounded-lg bg-rico-light px-3 py-2 text-sm font-bold text-carvao outline-none ring-1 ring-rico-wood/30 focus:ring-rico-red"
              />
              <input
                value={trocaPin.novo}
                onChange={(e) => setTrocaPin((p) => ({ ...p, novo: e.target.value.replace(/\D/g, '') }))}
                placeholder="Novo PIN"
                inputMode="numeric"
                maxLength={6}
                className="rounded-lg bg-rico-light px-3 py-2 text-sm font-bold text-carvao outline-none ring-1 ring-rico-wood/30 focus:ring-rico-red"
              />
            </div>
            <button className="mt-3 h-11 w-full rounded-lg bg-carvao text-sm font-bold text-rico-light transition hover:bg-carvao-claro">
              Atualizar meu PIN
            </button>
          </form>

          {pinGerado && (
            <div className="rounded-xl bg-brasa-gradiente p-5 text-white shadow-brasa">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/75">
                <KeyRound size={15} /> PIN gerado
              </p>
              <p className="mt-2 font-display text-5xl">{pinGerado.pin}</p>
              <p className="mt-1 text-sm font-bold text-white/80">{pinGerado.nome}</p>
            </div>
          )}
        </section>

        <section className="rounded-xl bg-white/80 shadow-media ring-1 ring-rico-wood/25">
          <div className="flex items-center justify-between gap-3 border-b border-rico-wood/25 px-5 py-4">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-rico-dark">
                Garcons e gerentes
              </h2>
              <p className="text-sm font-semibold text-carvao-suave">{ativos} ativo(s)</p>
            </div>
            <span className="rounded-lg bg-rico-red/10 p-2 text-rico-red">
              <ShieldCheck size={20} />
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left">
              <thead className="bg-rico-wood/12 text-xs font-bold uppercase tracking-wider text-rico-dark">
                <tr>
                  <th className="px-5 py-3">Nome</th>
                  <th className="px-5 py-3">Papel</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rico-wood/18">
                {usuarios.map((usuario) => (
                  <tr key={usuario.id} className={usuario.ativo ? 'odd:bg-white/60 even:bg-rico-light' : 'bg-carvao/5 opacity-60'}>
                    <td className="px-5 py-4 font-bold text-carvao">{usuario.nome}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-carvao-claro">{usuario.papel}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        usuario.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-carvao/10 text-carvao-suave'
                      }`}>
                        {usuario.ativo ? 'Ativo' : 'Desligado'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        {usuario.ativo && (
                          <>
                            <button
                              onClick={() => novoPin(usuario)}
                              className="rounded-lg bg-carvao px-3 py-2 text-xs font-bold text-rico-light"
                            >
                              <KeyRound size={14} className="inline" /> Novo PIN
                            </button>
                            <button
                              onClick={() => desligar(usuario)}
                              className="rounded-lg p-2 text-rico-red hover:bg-rico-red/10"
                              aria-label="Desligar"
                              title="Desligar"
                            >
                              <UserMinus size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
