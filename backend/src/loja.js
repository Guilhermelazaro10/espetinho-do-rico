// Identidade pública e regras da loja (cardápio online).
//
// Variáveis de ambiente (todas opcionais):
//   LOJA_WHATSAPP    -> só dígitos com DDI: 5588900000000
//   LOJA_ABERTURA    -> "HH:MM" (ex.: 17:00). Sem isso, sempre aberto.
//   LOJA_FECHAMENTO  -> "HH:MM" (ex.: 23:30). Pode virar a meia-noite (02:00).
//   LOJA_BAIRROS     -> JSON: [{"nome":"Centro","taxa":300}]  (taxa em centavos)

const nome = 'Espetinho do Rico';
const endereco = 'Rua Adolfo Francisco da Rocha, 608 — Bairro Juazeiro, Jaguaruana/CE';
const whatsapp = (process.env.LOJA_WHATSAPP || '').replace(/\D/g, '');

const ABERTURA = (process.env.LOJA_ABERTURA || '').trim();
const FECHAMENTO = (process.env.LOJA_FECHAMENTO || '').trim();

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

function hhmmParaMin(s) {
  const [h, m] = String(s).split(':').map(Number);
  return h * 60 + (m || 0);
}

// Minutos do dia (0..1439) AGORA no fuso de São Paulo (servidor roda em UTC).
function minutosAgoraSP() {
  const fmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const [h, m] = fmt.format(new Date()).split(':').map(Number);
  return h * 60 + m;
}

function statusHorario() {
  if (!ABERTURA || !FECHAMENTO) return { aberto: true, texto: '' };
  const agora = minutosAgoraSP();
  const ini = hhmmParaMin(ABERTURA);
  const fim = hhmmParaMin(FECHAMENTO);
  const aberto = fim > ini ? agora >= ini && agora < fim : agora >= ini || agora < fim;
  return { aberto, texto: `${ABERTURA} às ${FECHAMENTO}` };
}

module.exports = { nome, endereco, whatsapp, bairros, statusHorario };
