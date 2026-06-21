// Identidade pública da loja (cardápio online + link de WhatsApp).
// O WhatsApp deve ser só dígitos, com DDI: 55 + DDD + número.
// Ex.: (88) 90000-0000  ->  5588900000000  (configure em LOJA_WHATSAPP).
module.exports = {
  nome: 'Espetinho do Rico',
  endereco: 'Rua Adolfo Francisco da Rocha, 608 — Bairro Juazeiro, Jaguaruana/CE',
  whatsapp: (process.env.LOJA_WHATSAPP || '').replace(/\D/g, ''),
};
