// Identidade pública e regras da loja (cardápio online).
//
// Variáveis de ambiente (todas opcionais):
//   LOJA_WHATSAPP    -> só dígitos com DDI: 5588900000000
//   LOJA_ABERTURA    -> "HH:MM" (ex.: 17:00). Sem isso, sempre aberto.
//   LOJA_FECHAMENTO  -> "HH:MM" (ex.: 23:30). Pode virar a meia-noite (02:00).
//   LOJA_DIAS        -> dias que abre, 0=Dom..6=Sáb. Ex.: "2,3,4,5,6" (Ter–Sáb).
//                       Vazio = todos os dias.
//   LOJA_BAIRROS     -> JSON: [{"nome":"Centro","taxa":300}]  (taxa em centavos)

const nome = 'Espetinho do Rico';
const endereco = 'Rua Adolfo Francisco da Rocha, 608 — Bairro Juazeiro, Jaguaruana/CE';
const whatsapp = (process.env.LOJA_WHATSAPP || '').replace(/\D/g, '');

const ABERTURA = (process.env.LOJA_ABERTURA || '').trim();
const FECHAMENTO = (process.env.LOJA_FECHAMENTO || '').trim();
const NOMES_DIA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function bairros() {
  try {
    const lista = JSON.parse(process.env.LOJA_BAIRROS || '[]');
    return Array.isArray(lista)
      ? lista.filter((b) => b && typeof b.nome === 'string' && Number.isInteger(b.taxa))
      : [];
  } catch {
    return [];
  }
}

function parseDias() {
  return (process.env.LOJA_DIAS || '')
    .split(',')
    .map((d) => Number(d.trim()))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
}

function labelDias(dias) {
  if (!dias.length) return '';
  const ord = [...dias].sort((a, b) => a - b);
  const contiguo = ord.every((d, i) => i === 0 || d === ord[i - 1] + 1);
  return contiguo && ord.length > 1
    ? `${NOMES_DIA[ord[0]]} a ${NOMES_DIA[ord[ord.length - 1]]}`
    : ord.map((d) => NOMES_DIA[d]).join(', ');
}

function hhmmParaMin(s) {
  const [h, m] = String(s).split(':').map(Number);
  return h * 60 + (m || 0);
}

// Dia da semana (0=Dom) e minutos do dia AGORA em São Paulo (servidor roda em UTC).
function agoraSP() {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const v = (t) => partes.find((p) => p.type === t)?.value;
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { dia: map[v('weekday')], minutos: (Number(v('hour')) % 24) * 60 + Number(v('minute')) };
}

function statusHorario() {
  if (!ABERTURA || !FECHAMENTO) return { aberto: true, texto: '' };
  const dias = parseDias();
  const { dia, minutos } = agoraSP();
  const ini = hhmmParaMin(ABERTURA);
  const fim = hhmmParaMin(FECHAMENTO);
  const naHora = fim > ini ? minutos >= ini && minutos < fim : minutos >= ini || minutos < fim;
  const noDia = dias.length === 0 || dias.includes(dia);
  const label = labelDias(dias);
  const texto = `${label ? label + ', ' : ''}${ABERTURA} às ${FECHAMENTO}`;
  return { aberto: noDia && naHora, texto };
}

const NOMES_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

// Data atual (ano/mês/dia) no fuso de São Paulo.
function dataSP() {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const v = (t) => Number(p.find((x) => x.type === t)?.value);
  return { ano: v('year'), mes: v('month'), diaMes: v('day') };
}

// Próxima vez que a loja abre (pra oferecer agendamento quando fechada).
// Texto com data, ex.: "hoje às 17:00" ou "ter, 01/07 às 17:00".
function proximaAbertura() {
  if (!ABERTURA || !FECHAMENTO) return null;
  const dias = parseDias();
  if (!dias.length) return null;
  const { dia, minutos } = agoraSP();
  const ini = hhmmParaMin(ABERTURA);
  const { ano, mes, diaMes } = dataSP();
  for (let off = 0; off <= 7; off++) {
    const d = (dia + off) % 7;
    if (!dias.includes(d)) continue;
    if (off === 0 && minutos >= ini) continue; // hoje já passou da abertura
    if (off === 0) return { texto: `hoje às ${ABERTURA}` };
    const alvo = new Date(Date.UTC(ano, mes - 1, diaMes + off));
    const dd = String(alvo.getUTCDate()).padStart(2, '0');
    const mm = String(alvo.getUTCMonth() + 1).padStart(2, '0');
    return { texto: `${NOMES_CURTO[d]}, ${dd}/${mm} às ${ABERTURA}` };
  }
  return null;
}

module.exports = { nome, endereco, whatsapp, bairros, statusHorario, proximaAbertura };
