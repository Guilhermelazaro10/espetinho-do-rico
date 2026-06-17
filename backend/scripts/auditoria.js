/* Auditoria adversarial — ataca a API real e verifica concorrência no banco. */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const BASE = process.env.API_URL || 'http://localhost:3001';

let pass = 0;
const fails = [];
function check(nome, ok, detalhe = '') {
  if (ok) pass++;
  else fails.push(`${nome}${detalhe ? ` :: ${detalhe}` : ''}`);
  console.log(`${ok ? 'ok  ' : 'FAIL'} | ${nome}${detalhe ? ` :: ${detalhe}` : ''}`);
}

async function req(method, path, { token, body, raw, headers } = {}) {
  const h = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers };
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: h,
    body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  let json;
  try { json = JSON.parse(txt); } catch { json = txt; }
  return { status: res.status, json };
}
const login = async (pin) => (await req('POST', '/api/auth/login', { body: { pin } })).json?.token;

async function main() {
  const G = await login('9999'); // gerente
  const W = await login('1111'); // garçom
  check('login gerente ok', Boolean(G));
  check('login garçom ok', Boolean(W));
  const mesas = (await req('GET', '/api/mesas', { token: G })).json;
  const idMesa = (n) => mesas.find((m) => m.numero === n).id;

  // ===== AUTH =====
  check('mesas sem token → 401', (await req('GET', '/api/mesas')).status === 401);
  check('token lixo → 401', (await req('GET', '/api/mesas', { token: 'lixo.lixo.lixo' })).status === 401);
  const proibidoGarcom = [
    ['POST', '/api/mesas', { numero: 99 }],
    ['DELETE', '/api/mesas/1'],
    ['POST', '/api/produtos', { nome: 'x', preco: 100, categoria: 'y' }],
    ['DELETE', '/api/produtos/1'],
    ['POST', `/api/mesas/1/pagamentos`, { forma: 'pix', valor: 100 }],
    ['PATCH', '/api/mesas/1/taxa', { ativa: true }],
    ['GET', '/api/relatorios/faturamento'],
    ['GET', '/api/relatorios/auditoria'],
    ['GET', '/api/usuarios'],
    ['POST', '/api/usuarios', { nome: 'Hacker', papel: 'GERENTE' }],
    ['GET', '/api/caixa/atual'],
    ['POST', '/api/caixa/abrir', { fundoAbertura: 100 }],
    ['POST', '/api/pedidos/1/cancelar', { motivo: 'hack' }],
    ['PATCH', '/api/pedidos/1/pagamento', { formaPagamento: 'pix' }],
    ['DELETE', '/api/pedidos/1/itens/1'],
  ];
  for (const [m, p, b] of proibidoGarcom) {
    check(`garçom ${m} ${p} → 403`, (await req(m, p, { token: W, body: b })).status === 403);
  }
  check('garçom escala p/ GERENTE no token? (cria gerente) → 403', (await req('POST', '/api/usuarios', { token: W, body: { nome: 'X', papel: 'GERENTE' } })).status === 403);
  const semAg = await req('GET', '/api/impressao/proximos');
  check('fila impressão sem token de agente → bloqueado', [401, 503].includes(semAg.status), `got ${semAg.status}`);
  const jwtAg = await req('GET', '/api/impressao/proximos', { token: G });
  check('fila impressão com JWT de usuário → bloqueado', [401, 503].includes(jwtAg.status), `got ${jwtAg.status}`);

  // ===== INPUT MALFORMADO =====
  const mal = [
    ['pedido vazio', 'POST', '/api/pedidos', {}, 400],
    ['pedido sem body', 'POST', '/api/pedidos', undefined, 400],
    ['itens não-array', 'POST', '/api/pedidos', { mesaId: idMesa(1), itens: 'x' }, 400],
    ['mesaId negativo', 'POST', '/api/pedidos', { mesaId: -1, itens: [{ produtoId: 1, quantidade: 1 }] }, 400],
    ['quantidade 0', 'POST', '/api/pedidos', { mesaId: idMesa(1), itens: [{ produtoId: 1, quantidade: 0 }] }, 400],
    ['quantidade negativa', 'POST', '/api/pedidos', { mesaId: idMesa(1), itens: [{ produtoId: 1, quantidade: -3 }] }, 400],
    ['quantidade fracionária', 'POST', '/api/pedidos', { mesaId: idMesa(1), itens: [{ produtoId: 1, quantidade: 1.5 }] }, 400],
    ['produtoId texto', 'POST', '/api/pedidos', { mesaId: idMesa(1), itens: [{ produtoId: 'abc', quantidade: 1 }] }, 400],
    ['produto inexistente', 'POST', '/api/pedidos', { mesaId: idMesa(1), itens: [{ produtoId: 99999, quantidade: 1 }] }, 404],
    ['delivery sem telefone', 'POST', '/api/pedidos', { tipo: 'DELIVERY', clienteNome: 'Ana', clienteEndereco: 'Rua X 123', itens: [{ produtoId: 1, quantidade: 1 }] }, 400],
    ['delivery sem endereço', 'POST', '/api/pedidos', { tipo: 'DELIVERY', clienteNome: 'Ana', clienteTelefone: '11999990000', itens: [{ produtoId: 1, quantidade: 1 }] }, 400],
    ['balcão sem nome', 'POST', '/api/pedidos', { tipo: 'BALCAO', itens: [{ produtoId: 1, quantidade: 1 }] }, 400],
    ['tipo inválido', 'POST', '/api/pedidos', { tipo: 'XPTO', itens: [{ produtoId: 1, quantidade: 1 }] }, 400],
    ['produto preço negativo', 'POST', '/api/produtos', { nome: 'X', preco: -100, categoria: 'Y' }, 400],
    ['produto preço fracionário', 'POST', '/api/produtos', { nome: 'X', preco: 10.5, categoria: 'Y' }, 400],
    ['produto sem nome', 'POST', '/api/produtos', { preco: 100, categoria: 'Y' }, 400],
  ];
  for (const [nome, m, p, b, esp] of mal) {
    const r = await req(m, p, { token: G, body: b });
    check(`${nome} → ${esp}`, r.status === esp, `got ${r.status}`);
  }
  check('JSON malformado → 400', (await req('POST', '/api/pedidos', { token: G, raw: '{quebrado' })).status === 400);
  for (const [nome, pin] of [['pin curto', '12'], ['pin longo', '1234567'], ['pin não numérico', 'abcd'], ['pin vazio', '']]) {
    check(`login ${nome} → 400`, (await req('POST', '/api/auth/login', { body: { pin } })).status === 400, '');
  }

  // ===== MÁQUINA DE ESTADOS =====
  const balcao = (await req('POST', '/api/pedidos', { token: G, body: { tipo: 'BALCAO', clienteNome: 'Estado', itens: [{ produtoId: 1, quantidade: 1 }] } })).json;
  await req('PATCH', `/api/pedidos/${balcao.id}/status`, { token: G, body: { status: 'entregue' } });
  check('pagar balcão entregue → 200', (await req('PATCH', `/api/pedidos/${balcao.id}/pagamento`, { token: G, body: { formaPagamento: 'pix' } })).status === 200);
  check('pagar de novo (já pago) → 409', (await req('PATCH', `/api/pedidos/${balcao.id}/pagamento`, { token: G, body: { formaPagamento: 'pix' } })).status === 409);
  check('avançar pedido pago → 409', (await req('PATCH', `/api/pedidos/${balcao.id}/status`, { token: G, body: { status: 'entregue' } })).status === 409);
  check('cancelar pedido pago → 409', (await req('POST', `/api/pedidos/${balcao.id}/cancelar`, { token: G, body: { motivo: 'tarde demais' } })).status === 409);
  check('status inválido "voando" → 400', (await req('PATCH', `/api/pedidos/${balcao.id}/status`, { token: G, body: { status: 'voando' } })).status === 400);
  check('mudar status p/ "pago" pela rota de fluxo → 400', (await req('PATCH', `/api/pedidos/${balcao.id}/status`, { token: G, body: { status: 'pago' } })).status === 400);
  check('cancelar sem motivo → 400', (await req('POST', `/api/pedidos/${balcao.id}/cancelar`, { token: G, body: {} })).status === 400);

  const pedMesa = (await req('POST', '/api/pedidos', { token: G, body: { mesaId: idMesa(2), itens: [{ produtoId: 1, quantidade: 1 }] } })).json;
  check('pagar pedido de MESA pela rota avulsa → 409', (await req('PATCH', `/api/pedidos/${pedMesa.id}/pagamento`, { token: G, body: { formaPagamento: 'pix' } })).status === 409);

  // ===== DINHEIRO (modelo de pagamentos parciais) — mesa 2 tem 1 pedido de 1200 =====
  const mesa2 = idMesa(2);
  const parcial = await req('POST', `/api/mesas/${mesa2}/pagamentos`, { token: G, body: { forma: 'pix', valor: 500 } });
  check('parcial 500/1200 não libera (saldo 700)', parcial.status === 200 && parcial.json.liberada === false && parcial.json.saldoDevedor === 700, JSON.stringify(parcial.json));
  check('overpay com pix (troco só dinheiro) → 400', (await req('POST', `/api/mesas/${mesa2}/pagamentos`, { token: G, body: { forma: 'pix', valor: 5000 } })).status === 400);
  const quita = await req('POST', `/api/mesas/${mesa2}/pagamentos`, { token: G, body: { forma: 'dinheiro', valor: 5000 } });
  check('quitar com dinheiro: troco 4300 + libera', quita.status === 200 && quita.json.liberada === true && quita.json.troco === 4300, JSON.stringify(quita.json));
  check('registrar pagamento valor 0 → 400', (await req('POST', `/api/mesas/${idMesa(3)}/pagamentos`, { token: G, body: { forma: 'dinheiro', valor: 0 } })).status === 400);
  check('registrar pagamento valor negativo → 400', (await req('POST', `/api/mesas/${idMesa(3)}/pagamentos`, { token: G, body: { forma: 'dinheiro', valor: -500 } })).status === 400);
  check('registrar pagamento forma inválida → 400', (await req('POST', `/api/mesas/${idMesa(3)}/pagamentos`, { token: G, body: { forma: 'bitcoin', valor: 500 } })).status === 400);

  // ===== MESA MGMT =====
  await req('POST', '/api/pedidos', { token: G, body: { mesaId: idMesa(6), itens: [{ produtoId: 1, quantidade: 1 }] } }); // ocupa a 6
  check('remover mesa ocupada → 409', (await req('DELETE', `/api/mesas/${idMesa(6)}`, { token: G })).status === 409);
  const m1pedidos = await prisma.pedido.count({ where: { mesaId: idMesa(1) } });
  if (m1pedidos === 0) {
    // mesa 1 está livre e sem histórico → deve remover (204). recriamos depois.
    check('remover mesa livre sem histórico → 204', (await req('DELETE', `/api/mesas/${idMesa(1)}`, { token: G })).status === 204);
    await req('POST', '/api/mesas', { token: G, body: { numero: 1 } });
  }
  check('criar mesa com número duplicado → 409', (await req('POST', '/api/mesas', { token: G, body: { numero: 3 } })).status === 409);

  // ===== CONCORRÊNCIA: pagamento de mesa (corrida) =====
  const mesaCorrida = idMesa(5);
  await req('POST', '/api/pedidos', { token: G, body: { mesaId: mesaCorrida, itens: [{ produtoId: 1, quantidade: 1 }] } }); // total 1200
  const tiros = await Promise.all(
    Array.from({ length: 6 }, () =>
      req('POST', `/api/mesas/${mesaCorrida}/pagamentos`, { token: G, body: { forma: 'dinheiro', valor: 1200 } })
    )
  );
  const ok200 = tiros.filter((t) => t.status === 200);
  const liberadas = ok200.filter((t) => t.json.liberada).length;
  const pagamentosNaMesa = await prisma.pagamento.count({ where: { mesaId: mesaCorrida } });
  const mesa5 = await prisma.mesa.findUnique({ where: { id: mesaCorrida } });
  check('CORRIDA pagamento mesa: exatamente 1 liberou', liberadas === 1, `liberadas=${liberadas} status=${tiros.map((t) => t.status).join(',')}`);
  check('CORRIDA pagamento mesa: exatamente 1 pagamento gravado (sem cobrar 6x)', pagamentosNaMesa === 1, `pagamentos=${pagamentosNaMesa}`);
  check('CORRIDA pagamento mesa: mesa liberada (LIVRE)', mesa5.status === 'LIVRE', mesa5.status);

  // ===== CONCORRÊNCIA: abertura de caixa (corrida) =====
  await prisma.movimentoCaixa.deleteMany();
  await prisma.caixa.deleteMany();
  const aberturas = await Promise.all(
    Array.from({ length: 4 }, () => req('POST', '/api/caixa/abrir', { token: G, body: { fundoAbertura: 10000 } }))
  );
  const caixasAbertos = await prisma.caixa.count({ where: { status: 'aberto' } });
  check('CORRIDA abrir caixa: só 1 caixa aberto no banco', caixasAbertos === 1, `caixas abertos=${caixasAbertos} status=${aberturas.map((a) => a.status).join(',')}`);

  // ===== CONCORRÊNCIA: pagamento de avulso (corrida) =====
  const av = (await req('POST', '/api/pedidos', { token: G, body: { tipo: 'BALCAO', clienteNome: 'Corrida', itens: [{ produtoId: 1, quantidade: 1 }] } })).json;
  await req('PATCH', `/api/pedidos/${av.id}/status`, { token: G, body: { status: 'entregue' } });
  const tirosAv = await Promise.all(
    Array.from({ length: 6 }, () => req('PATCH', `/api/pedidos/${av.id}/pagamento`, { token: G, body: { formaPagamento: 'pix' } }))
  );
  const avOk = tirosAv.filter((t) => t.status === 200).length;
  const avPag = await prisma.pagamento.count({ where: { pedidoId: av.id } });
  check('CORRIDA pagar avulso: exatamente 1 sucesso', avOk === 1, `ok=${avOk} status=${tirosAv.map((t) => t.status).join(',')}`);
  check('CORRIDA pagar avulso: exatamente 1 pagamento gravado', avPag === 1, `pagamentos=${avPag}`);

  // ===== CORS =====
  const cors = await req('GET', '/health', { headers: { Origin: 'http://evil.example.com' } });
  check('CORS bloqueia origem desconhecida → 403', cors.status === 403, `got ${cors.status}`);

  console.log(`\n===== RESULTADO: ${pass} passaram, ${fails.length} falharam =====`);
  if (fails.length) {
    console.log('FALHAS:');
    for (const f of fails) console.log('  - ' + f);
  }
  await prisma.$disconnect();
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => {
  console.error('ERRO NO SCRIPT:', e);
  process.exit(2);
});
