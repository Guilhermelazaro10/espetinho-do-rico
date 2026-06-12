// Monta um cenário de demonstração via API real:
// mesa 2 ocupada, mesa 5 ocupada (2 comandas), mesa 8 aguardando conta.
const BASE = process.env.API_URL || 'http://localhost:3001';
let TOKEN = null;

async function chamar(metodo, rota, corpo) {
  const res = await fetch(`${BASE}${rota}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const dados = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${metodo} ${rota} -> ${res.status}: ${dados?.erro}`);
  return dados;
}

async function main() {
  const login = await chamar('POST', '/api/auth/login', { pin: '9999' });
  TOKEN = login.token;

  // Resolve mesas pelo número (IDs podem variar entre seeds)
  const mesas = await chamar('GET', '/api/mesas');
  const idDaMesa = (numero) => {
    const mesa = mesas.find((m) => m.numero === numero);
    if (!mesa) throw new Error(`Mesa ${numero} não existe no banco`);
    return mesa.id;
  };

  await chamar('POST', '/api/pedidos', {
    mesaId: idDaMesa(2),
    itens: [
      { produtoId: 1, quantidade: 2 },
      { produtoId: 4, quantidade: 2, observacao: 'bem gelada' },
    ],
  });

  await chamar('POST', '/api/pedidos', {
    mesaId: idDaMesa(5),
    itens: [{ produtoId: 3, quantidade: 1, observacao: 'ao ponto' }],
  });
  await chamar('POST', '/api/pedidos', {
    mesaId: idDaMesa(5),
    itens: [
      { produtoId: 2, quantidade: 3 },
      { produtoId: 5, quantidade: 2 },
    ],
  });

  await chamar('POST', '/api/pedidos', {
    mesaId: idDaMesa(8),
    itens: [
      { produtoId: 1, quantidade: 4 },
      { produtoId: 4, quantidade: 6 },
    ],
  });
  await chamar('PATCH', `/api/mesas/${idDaMesa(8)}/status`, { status: 'fechando' });

  console.log('Cenário pronto: mesas 2 e 5 ocupadas, mesa 8 aguardando conta.');
}

main().catch((e) => {
  console.error('FALHA:', e.message);
  process.exit(1);
});
