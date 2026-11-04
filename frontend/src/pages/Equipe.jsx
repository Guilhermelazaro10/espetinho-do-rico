import { useCallback, useEffect, useState } from 'react';
import {
  Copy, ExternalLink, KeyRound, Plus, RefreshCw, Share2, ShieldCheck,
  Smartphone, UserMinus, Users, Wifi,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import { api } from '../lib/api';
import { PAPEIS, ehGerente } from '../lib/constantes';
import { notificar } from '../ui/toast';
import { confirmar } from '../lib/dialogos';
import { plural } from '../lib/plural';
import AcaoTopo from '../ui/AcaoTopo';
import Campo from '../ui/Campo';
import Selo from '../ui/Selo';

const NOME_PAPEL = { [PAPEIS.GERENTE]: 'Gerente', [PAPEIS.GARCOM]: 'Garçom' };

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
      notificar.erro('Equipe indisponível', e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  function alterar(campo, valor) {
    setForm((atual) => {
      const novo = { ...atual, [campo]: valor };
      // Gerente sempre com 6 dígitos (o servidor recusa menos)
      if (novo.papel === PAPEIS.GERENTE) novo.tamanhoPin = 6;
      return novo;
    });
  }

  async function trocarMeuPin(e) {
    e.preventDefault();
    const souGerente = ehGerente(sessao);
    if (souGerente ? !/^\d{6}$/.test(trocaPin.novo) : !/^\d{4,6}$/.test(trocaPin.novo)) {
      notificar.erro('PIN inválido', souGerente ? 'PIN de gerente deve ter 6 dígitos' : 'O novo PIN deve ter de 4 a 6 dígitos');
      return;
    }
    try {
      await api.perfil.trocarPin({ pinAtual: trocaPin.atual, pinNovo: trocaPin.novo });
      setTrocaPin({ atual: '', novo: '' });
      notificar.sucesso('PIN alterado', 'Use o novo PIN no próximo login');
    } catch (erro) {
      notificar.erro('Não foi possível trocar', erro.message);
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
      notificar.sucesso('Funcionário cadastrado', `PIN ${criado.pin}`);
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
      notificar.erro('PIN não gerado', e.message);
    }
  }

  async function desligar(usuario) {
    const ok = await confirmar({
      titulo: `Desligar ${usuario.nome}?`,
      mensagem: 'O PIN é revogado na hora. O histórico do funcionário é preservado.',
      confirmarRotulo: 'Desligar',
      perigo: true,
    });
    if (!ok) return;
    try {
      await api.usuarios.desligar(usuario.id);
      notificar.sucesso('Funcionário desligado', usuario.nome);
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
      notificar.sucesso('Link copiado', 'Envie para os garçons pelo WhatsApp');
    } catch {
      notificar.erro('Não foi possível copiar', link);
    }
  }

  async function compartilharLinkGarcom() {
    const link = rede?.urlPreferencialGarcom;
    if (!link) return;
    const texto = `Acesso Garçom - Espetinho do Rico: ${link}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Acesso Garçom', text: texto, url: link });
        return;
      } catch {
        return;
      }
    }
    await copiarLinkGarcom();
  }

  const ativos = usuarios.filter((usuario) => usuario.ativo).length;

  const acoes = <AcaoTopo icone={RefreshCw} rotulo="Atualizar equipe" variante="escura" girando={carregando} onClick={recarregar} />;

  return (
    <AppShell titulo="Equipe" acoes={acoes} sessao={sessao} aoSair={aoSair}>
      {/* grid-cols-1 = minmax(0,1fr): sem isso o min-w da tabela estica a página no celular */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="space-y-4">
          <div className="rounded-xl border border-rico-wood/25 bg-white/85 p-5 shadow-media ring-1 ring-rico-wood/10">
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-rico-red/10 p-3 text-rico-red">
                <Smartphone size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold text-rico-dark">
                  Acesso dos garçons
                </h2>
                <p className="mt-1 text-sm font-semibold text-carvao-suave">
                  Link atual para celulares na mesma rede Wi-Fi do caixa.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-rico-dark p-3 text-rico-light">
              <p className="flex items-center gap-2 text-rotulo font-semibold text-rico-wood">
                <Wifi size={14} /> Rede atual
              </p>
              <p className="mt-1 break-all text-sm font-bold">
                {rede?.urlPreferencialGarcom ?? 'Detectando rede local...'}
              </p>
              {rede?.nomeComputador && (
                <p className="mt-1 text-xs font-semibold text-rico-light/75">
                  {rede.nomeComputador} - porta {rede.porta}
                </p>
              )}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={copiarLinkGarcom}
                disabled={!rede?.urlPreferencialGarcom}
                className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-rico-red text-sm font-semibold text-white transition-colors hover:bg-vinho-profundo disabled:bg-creme-escuro disabled:text-carvao-suave"
              >
                <Copy size={17} /> Copiar
              </button>
              <button
                type="button"
                onClick={compartilharLinkGarcom}
                disabled={!rede?.urlPreferencialGarcom}
                className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-rico-wood/45 bg-white text-sm font-semibold text-carvao transition-colors hover:bg-creme-escuro disabled:border-transparent disabled:bg-creme-escuro disabled:text-carvao-suave"
              >
                <Share2 size={17} /> Enviar
              </button>
            </div>

            <a
              href={rede?.urlPreferencialGarcom ?? '#/garcom'}
              className="mt-2 flex h-11 items-center justify-center gap-2 rounded-xl bg-rico-wood/14 text-sm font-bold text-rico-dark ring-1 ring-rico-wood/30"
            >
              <ExternalLink size={16} /> Abrir modo garçom
            </a>
          </div>

          <form onSubmit={cadastrar} className="rounded-xl bg-rico-dark p-5 text-rico-light shadow-media">
            <h2 className="flex items-center gap-2 text-sm font-bold text-rico-light/85">
              <Users size={16} aria-hidden="true" /> Novo funcionário
            </h2>
            <div className="mt-4 space-y-3">
              <Campo tom="escuro" rotulo="Nome" value={form.nome} onChange={(e) => alterar('nome', e.target.value)} required autoComplete="off" />
              <Campo
                tom="escuro"
                como="select"
                rotulo="Papel"
                value={form.papel}
                onChange={(e) => alterar('papel', e.target.value)}
                dica={form.papel === PAPEIS.GERENTE ? 'Gerente mexe em dinheiro: o PIN tem sempre 6 dígitos.' : undefined}
              >
                <option value={PAPEIS.GARCOM}>Garçom</option>
                <option value={PAPEIS.GERENTE}>Gerente</option>
              </Campo>
              <Campo
                tom="escuro"
                como="select"
                rotulo="Dígitos do PIN"
                value={form.tamanhoPin}
                onChange={(e) => alterar('tamanhoPin', e.target.value)}
                disabled={form.papel === PAPEIS.GERENTE}
              >
                <option value={4}>4 dígitos</option>
                <option value={5}>5 dígitos</option>
                <option value={6}>6 dígitos</option>
              </Campo>
            </div>
            <button type="submit" className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-rico-red font-semibold text-white transition-colors hover:bg-vinho-profundo">
              <Plus size={17} /> Cadastrar
            </button>
          </form>

          <form onSubmit={trocarMeuPin} className="rounded-xl border border-rico-wood/25 bg-white/85 p-5 shadow-suave ring-1 ring-rico-wood/10">
            <h2 className="flex items-center gap-2 text-sm font-bold text-rico-dark">
              <KeyRound size={16} className="text-rico-red" /> Trocar meu PIN
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Campo
                rotulo="PIN atual"
                value={trocaPin.atual}
                onChange={(e) => setTrocaPin((p) => ({ ...p, atual: e.target.value.replace(/\D/g, '') }))}
                inputMode="numeric"
                type="password"
                autoComplete="current-password"
                maxLength={6}
              />
              <Campo
                rotulo="Novo PIN"
                value={trocaPin.novo}
                onChange={(e) => setTrocaPin((p) => ({ ...p, novo: e.target.value.replace(/\D/g, '') }))}
                inputMode="numeric"
                type="password"
                autoComplete="new-password"
                maxLength={6}
              />
            </div>
            <button type="submit" className="mt-4 min-h-11 w-full rounded-lg bg-carvao text-sm font-semibold text-creme transition-colors hover:bg-carvao-claro">
              Atualizar meu PIN
            </button>
          </form>

          {pinGerado && (
            <div className="rounded-2xl bg-carvao p-5 text-creme shadow-suave" role="status">
              <p className="flex items-center gap-2 text-rotulo font-semibold text-creme/80">
                <KeyRound size={15} /> PIN gerado
              </p>
              <p className="mt-2 font-display text-5xl tracking-wide text-brasa-clara tabular-nums">{pinGerado.pin}</p>
              <p className="mt-1 text-sm font-bold text-creme/85">{pinGerado.nome}</p>
            </div>
          )}
        </section>

        <section className="rounded-xl bg-white/80 shadow-media ring-1 ring-rico-wood/25">
          <div className="flex items-center justify-between gap-3 border-b border-rico-wood/25 px-5 py-4">
            <div>
              <h2 className="text-sm font-bold text-rico-dark">
                Garçons e gerentes
              </h2>
              <p className="text-sm font-semibold text-carvao-suave">{plural(ativos, 'ativo', 'ativos')}</p>
            </div>
            <span className="rounded-lg bg-rico-red/10 p-2 text-rico-red">
              <ShieldCheck size={20} />
            </span>
          </div>

          {/* Celular: um card por pessoa — nada escondido em rolagem lateral */}
          <ul className="divide-y divide-creme-escuro md:hidden">
            {usuarios.map((usuario) => (
              <li key={usuario.id} className="flex flex-col gap-3 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`break-words font-bold ${usuario.ativo ? 'text-carvao' : 'text-carvao-suave'}`}>{usuario.nome}</p>
                    <p className="text-rotulo text-carvao-suave">{NOME_PAPEL[usuario.papel] ?? usuario.papel}</p>
                  </div>
                  <Selo tom={usuario.ativo ? 'ok' : 'neutro'}>{usuario.ativo ? 'Ativo' : 'Desligado'}</Selo>
                </div>
                {usuario.ativo && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => novoPin(usuario)}
                      className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-carvao text-sm font-semibold text-creme hover:bg-carvao-claro"
                    >
                      <KeyRound size={16} aria-hidden="true" /> Novo PIN
                    </button>
                    <button
                      type="button"
                      onClick={() => desligar(usuario)}
                      className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-white text-sm font-semibold text-rico-red ring-1 ring-inset ring-rico-red/40 hover:bg-erro-fundo"
                    >
                      <UserMinus size={16} aria-hidden="true" /> Desligar
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>

          <div className="hidden md:block">
            <table className="w-full text-left">
              <thead className="bg-creme-escuro text-rotulo font-semibold text-carvao">
                <tr>
                  <th scope="col" className="px-5 py-3">Nome</th>
                  <th scope="col" className="px-5 py-3">Papel</th>
                  <th scope="col" className="px-5 py-3">Status</th>
                  <th scope="col" className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-creme-escuro">
                {usuarios.map((usuario) => (
                  <tr key={usuario.id} className={usuario.ativo ? '' : 'bg-creme'}>
                    <td className={`px-5 py-3 font-bold ${usuario.ativo ? 'text-carvao' : 'text-carvao-suave'}`}>{usuario.nome}</td>
                    <td className="px-5 py-3 text-sm text-carvao-claro">{NOME_PAPEL[usuario.papel] ?? usuario.papel}</td>
                    <td className="px-5 py-3">
                      <Selo tom={usuario.ativo ? 'ok' : 'neutro'}>{usuario.ativo ? 'Ativo' : 'Desligado'}</Selo>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        {usuario.ativo && (
                          <>
                            <button
                              type="button"
                              onClick={() => novoPin(usuario)}
                              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-carvao px-3.5 text-sm font-semibold text-creme hover:bg-carvao-claro"
                            >
                              <KeyRound size={16} aria-hidden="true" /> Novo PIN
                            </button>
                            <button
                              type="button"
                              onClick={() => desligar(usuario)}
                              className="grid h-11 w-11 place-items-center rounded-lg text-rico-red hover:bg-erro-fundo"
                              aria-label={`Desligar ${usuario.nome}`}
                              title="Desligar"
                            >
                              <UserMinus size={18} aria-hidden="true" />
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
