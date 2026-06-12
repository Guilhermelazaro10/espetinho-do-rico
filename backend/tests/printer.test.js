const { montarLinhasCupom, montarLinhasPreConta, LARGURA } = require('../src/services/printerService');

describe('PrinterService — formatação do cupom 80mm', () => {
  const pedido = {
    id: 42,
    total: 4800, // centavos
    criadoEm: '2026-06-11T21:30:00.000Z',
    mesa: { numero: 7 },
    itens: [
      { quantidade: 2, produto: { nome: 'Espeto de Carne' } },
      {
        quantidade: 1,
        produto: { nome: 'Cerveja' },
        observacao: 'bem gelada, sem espuma e com limão por favor',
      },
    ],
  };

  it('nenhuma linha ultrapassa a largura da bobina (48 colunas)', () => {
    for (const linha of montarLinhasCupom(pedido)) {
      expect(linha.length).toBeLessThanOrEqual(LARGURA);
    }
  });

  it('cabeçalho ESPETINHO DO RICO vem centralizado', () => {
    const linhas = montarLinhasCupom(pedido);
    const cabecalho = linhas.find((l) => l.includes('ESPETINHO DO RICO'));
    const esquerda = cabecalho.length - cabecalho.trimStart().length;
    const direita = LARGURA - cabecalho.length;
    expect(Math.abs(esquerda - direita)).toBeLessThanOrEqual(1);
  });

  it('contém data/hora, número da mesa e itens com quantidade', () => {
    const texto = montarLinhasCupom(pedido).join('\n');
    expect(texto).toMatch(/11\/06\/2026/);
    expect(texto).toContain('MESA 07');
    expect(texto).toContain('PEDIDO #42');
    expect(texto).toMatch(/Espeto de Carne\s+x2/);
    expect(texto).toMatch(/Cerveja\s+x1/);
    expect(texto).toMatch(/TOTAL DO PEDIDO\s+R\$ 48,00/);
  });

  it('observações aparecem destacadas em caixa alta com marcador >>>', () => {
    const linhas = montarLinhasCupom(pedido);
    const observacoes = linhas.filter((l) => l.startsWith('  >>> '));
    expect(observacoes.length).toBeGreaterThan(0);
    expect(observacoes.join(' ')).toContain('BEM GELADA');
    // observação longa quebra em múltiplas linhas sem estourar a bobina
    for (const linha of observacoes) {
      expect(linha.length).toBeLessThanOrEqual(LARGURA);
    }
  });

  it('cupom de DELIVERY traz cliente, endereço e taxa de entrega', () => {
    const delivery = {
      ...pedido,
      tipo: 'DELIVERY',
      clienteNome: 'Ana Souza',
      clienteTelefone: '11 99999-0000',
      clienteEndereco: 'Rua das Brasas, 123 - Bairro Fogo Alto',
      taxaEntrega: 500,
      total: 5300,
    };
    const texto = montarLinhasCupom(delivery).join('\n');
    expect(texto).toContain('DELIVERY');
    expect(texto).toContain('Ana Souza');
    expect(texto).toContain('Rua das Brasas');
    expect(texto).toMatch(/Taxa de entrega\s+R\$ 5,00/);
    expect(texto).toMatch(/TOTAL DO PEDIDO\s+R\$ 53,00/);
  });

  it('cupom de BALCÃO identifica a retirada pelo nome', () => {
    const balcao = { ...pedido, tipo: 'BALCAO', clienteNome: 'Carlos' };
    const texto = montarLinhasCupom(balcao).join('\n');
    expect(texto).toContain('BALCAO / RETIRADA');
    expect(texto).toContain('Carlos');
  });
});

describe('PrinterService — pré-conta (conferência)', () => {
  const conta = {
    mesa: { numero: 7 },
    comandas: [
      {
        itens: [
          { quantidade: 2, precoUnitario: 1500, produto: { nome: 'Medalhão' } },
          { quantidade: 2, precoUnitario: 800, produto: { nome: 'Cerveja' } },
        ],
      },
    ],
    subtotal: 4600,
    taxa: 460,
    totalDevido: 5060,
    pago: 0,
    saldoDevedor: 5060,
  };

  it('é claramente identificada como conferência, não documento fiscal', () => {
    const texto = montarLinhasPreConta(conta).join('\n');
    expect(texto).toContain('PRE-CONTA');
    expect(texto).toContain('NAO E DOCUMENTO FISCAL');
    expect(texto).toContain('Pagamento somente no caixa');
  });

  it('lista itens com preços congelados, taxa e total', () => {
    const texto = montarLinhasPreConta(conta).join('\n');
    expect(texto).toMatch(/2x Medalhão\s+R\$ 30,00/);
    expect(texto).toMatch(/Taxa de servico 10%\s+R\$ 4,60/);
    expect(texto).toMatch(/TOTAL A PAGAR\s+R\$ 50,60/);
  });

  it('com pagamento parcial mostra o saldo restante', () => {
    const texto = montarLinhasPreConta({ ...conta, pago: 2000, saldoDevedor: 3060 }).join('\n');
    expect(texto).toMatch(/Pago parcialmente\s+- R\$ 20,00/);
    expect(texto).toMatch(/SALDO A PAGAR\s+R\$ 30,60/);
  });

  it('nenhuma linha estoura as 48 colunas da bobina', () => {
    for (const linha of montarLinhasPreConta(conta)) {
      expect(linha.length).toBeLessThanOrEqual(LARGURA);
    }
  });
});
