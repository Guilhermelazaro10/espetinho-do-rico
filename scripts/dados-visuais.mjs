// Dados para a auditoria visual: completa o cenario-demo.js com o que ele não
// cria (delivery, balcão, venda rápida, pedido online pendente) e com textos
// longos de propósito, para pegar nome e endereço que estouram o layout.
//
// SOMENTE banco de desenvolvimento. Recusa rodar contra outra coisa que não
// seja localhost.
//
// Uso (API no ar em :3001, depois do seed e do cenario-demo.js):
//   node scripts/dados-visuais.mjs
const BASE = process.env.API_URL || 'http://localhost:3001';
const PIN = process.env.PIN_GERENTE || '9999';

if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) {
  console.error(`Recusado: ${BASE} não é localhost. Este script só roda no banco de dev.`);
  process.exit(1);
}

let token = null;
async function chamar(metodo, rota, corpo) {
  const res = await fetch(`${BASE}${rota}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const dados = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${metodo} ${rota} -> ${res.status}: ${dados?.erro}`);
  return dados;
}

// Tenta e segue: o cenário é para olhar telas, não deve parar no primeiro 409.
async function tentar(descricao, fn) {
  try {
    await fn();
    console.log(`ok   ${descricao}`);
  } catch (e) {
    console.log(`pulo ${descricao}: ${e.message}`);
  }
}

token = (await chamar('POST', '/api/auth/login', { pin: PIN })).token;

const { loja, categorias } = await chamar('GET', '/api/publico/cardapio');
const produtos = categorias.flatMap((c) => c.itens);
const maisLongo = [...produtos].sort((a, b) => b.nome.length - a.nome.length);
const id = (i) => produtos[i % produtos.length].id;
const bairro = loja.bairros?.at(-1)?.nome; // o de nome mais comprido, no .env de dev

const NOME_LONGO = 'Maria Aparecida dos Santos Albuquerque Figueiredo';
const ENDERECO_LONGO =
  'Rua Coronel Francisco Albuquerque de Vasconcelos, 1234, casa dos fundos, portão azul, ao lado da igreja';

await tentar('mesa 8 aguardando pagamento (o cenario-demo usa um status inválido)', async () => {
  const mesas = await chamar('GET', '/api/mesas');
  const mesa8 = mesas.find((m) => m.numero === 8);
  await chamar('PATCH', `/api/mesas/${mesa8.id}/status`, { status: 'AGUARDANDO_PAGAMENTO' });
});

await tentar('caixa aberto (a venda rápida entra no turno)', () =>
  chamar('POST', '/api/caixa/abrir', { fundoAbertura: 10000 })
);

await tentar('delivery com nome e endereço longos', () =>
  chamar('POST', '/api/pedidos', {
    tipo: 'DELIVERY',
    clienteNome: NOME_LONGO,
    clienteTelefone: '(88) 99999-1234',
    clienteEndereco: ENDERECO_LONGO,
    taxaEntrega: 500,
    itens: [
      { produtoId: maisLongo[0].id, quantidade: 3, observacao: 'sem cebola, bem passado, molho à parte' },
      { produtoId: maisLongo[1].id, quantidade: 1 },
      { produtoId: id(3), quantidade: 2 },
    ],
  })
);

await tentar('delivery curto', () =>
  chamar('POST', '/api/pedidos', {
    tipo: 'DELIVERY',
    clienteNome: 'Davi',
    clienteTelefone: '88999990000',
    clienteEndereco: 'Rua A, 10',
    taxaEntrega: 300,
    itens: [{ produtoId: id(1), quantidade: 1 }],
  })
);

await tentar('balcão (retirada) com nome longo', () =>
  chamar('POST', '/api/pedidos', {
    tipo: 'BALCAO',
    clienteNome: 'Francisco Wellington Bezerra de Menezes Júnior',
    itens: [
      { produtoId: maisLongo[2].id, quantidade: 2 },
      { produtoId: id(5), quantidade: 4 },
    ],
  })
);

await tentar('venda rápida em dinheiro com troco (vai pra chapa)', () =>
  chamar('POST', '/api/pedidos/venda-rapida', {
    itens: [{ produtoId: id(0), quantidade: 3 }, { produtoId: id(2), quantidade: 1 }],
    formaPagamento: 'dinheiro',
    valorRecebido: 10000,
    entregueNaHora: false,
  })
);

await tentar('venda rápida no Pix entregue na hora', () =>
  chamar('POST', '/api/pedidos/venda-rapida', {
    itens: [{ produtoId: id(4), quantidade: 2 }],
    formaPagamento: 'pix',
    entregueNaHora: true,
  })
);

// Pedido online: rota pública, sem token. Fica "pendente" até alguém aceitar.
token = null;
await tentar('pedido online pendente (entrega, nome e endereço longos)', () =>
  chamar('POST', '/api/publico/pedidos', {
    tipo: 'DELIVERY',
    clienteNome: 'Luana Freitas de Oliveira Cavalcante Sampaio',
    clienteTelefone: '(88) 98888-7777',
    clienteEndereco: ENDERECO_LONGO.slice(0, 120),
    bairro,
    pagamentoPretendido: 'pix',
    agendado: true,
    itens: [
      { produtoId: maisLongo[0].id, quantidade: 2 },
      { produtoId: id(6), quantidade: 3, observacao: 'caprichar na farofa' },
    ],
  })
);
await tentar('pedido online pendente (retirada)', () =>
  chamar('POST', '/api/publico/pedidos', {
    tipo: 'BALCAO',
    clienteNome: 'Zé',
    clienteTelefone: '88911112222',
    agendado: true,
    itens: [{ produtoId: id(7), quantidade: 1 }],
  })
);

console.log('\nDados visuais prontos.');
