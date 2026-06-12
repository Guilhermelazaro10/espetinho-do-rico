// Smoke test manual contra a API real (banco SQLite de dev).
// Uso: suba a API e rode `node scripts/smoke.js`.
const BASE = process.env.API_URL || 'http://localhost:3001';
let TOKEN = null;

async function chamar(metodo, rota, corpo, corpoCru) {
  const res = await fetch(`${BASE}${rota}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
    body: corpoCru ?? (corpo ? JSON.stringify(corpo) : undefined),
  });
  const texto = await res.text();
  let dados;
  try { dados = JSON.parse(texto); } catch { dados = texto; }
  console.log(`${metodo} ${rota} -> ${res.status}`);
  return { status: res.status, dados };
}

async function main() {
  // Sem token: API deve recusar
  const bloqueado = await chamar('GET', '/api/mesas');
  if (bloqueado.status !== 401) throw new Error('API deveria exigir autenticação');

  // Login como gerente (PIN de desenvolvimento)
  const login = await chamar('POST', '/api/auth/login', { pin: '9999' });
  if (login.status !== 200) throw new Error('login falhou');
  TOKEN = login.dados.token;

  const mesas = await chamar('GET', '/api/mesas');
  if (mesas.status !== 200 || mesas.dados.length !== 10) throw new Error('listagem de mesas falhou');
  const idDaMesa = (numero) => mesas.dados.find((m) => m.numero === numero).id;

  const vazio = await chamar('POST', '/api/pedidos', { mesaId: idDaMesa(1), itens: [] });
  if (vazio.status !== 400) throw new Error('pedido vazio deveria ser 400');

  const quebrado = await chamar('POST', '/api/pedidos', null, '{isso nao é json');
  if (quebrado.status !== 400) throw new Error('JSON malformado deveria ser 400');

  // Pedido válido: 2x Espeto de Carne (1200) + 3x Cerveja (800) = 4800 centavos
  const pedido = await chamar('POST', '/api/pedidos', {
    mesaId: idDaMesa(1),
    itens: [
      { produtoId: 1, quantidade: 2 },
      { produtoId: 4, quantidade: 3, observacao: 'bem gelada' },
    ],
  });
  if (pedido.status !== 201) throw new Error('criação de pedido falhou');
  console.log(`  total: ${pedido.dados.total} centavos | mesa: ${pedido.dados.mesa.status}`);
  if (pedido.dados.total !== 4800) throw new Error('total incorreto');
  if (pedido.dados.itens[0].precoUnitario !== 1200) throw new Error('preço não congelado no item');

  // Fechamento da mesa com taxa e pagamento dividido (pix + dinheiro com troco)
  const fechamento = await chamar('POST', `/api/mesas/${idDaMesa(1)}/fechar-conta`, {
    comTaxa: true,
    pagamentos: [
      { forma: 'pix', valor: 3000 },
      { forma: 'dinheiro', valor: 3000 },
    ],
  });
  if (fechamento.status !== 200) throw new Error(`fechamento falhou: ${JSON.stringify(fechamento.dados)}`);
  console.log(`  fechamento: total ${fechamento.dados.totalGeral} | taxa ${fechamento.dados.taxa} | troco ${fechamento.dados.troco}`);
  if (fechamento.dados.totalGeral !== 5280) throw new Error('total geral com taxa incorreto'); // 4800 + 480
  if (fechamento.dados.troco !== 720) throw new Error('troco incorreto'); // 6000 - 5280

  const mesa1 = await chamar('GET', `/api/mesas/${idDaMesa(1)}`);
  if (mesa1.dados.status !== 'livre') throw new Error('mesa deveria voltar a livre');

  // Relatório do dia precisa refletir o pagamento líquido (6000 - 720 = 5280)
  const rel = await chamar('GET', '/api/relatorios/fechamento');
  if (rel.dados.recebido.total !== 5280) throw new Error(`relatório não bate: ${rel.dados.recebido.total}`);
  console.log(`  relatório: recebido ${rel.dados.recebido.total} centavos`);

  const saude = await chamar('GET', '/health');
  if (saude.status !== 200) throw new Error('health check falhou no final');

  console.log('SMOKE OK: auth, pedido, fechamento dividido com taxa/troco e relatório conferem.');
}

main().catch((e) => {
  console.error('SMOKE FALHOU:', e.message);
  process.exit(1);
});
