/*
 * Descoberta automática da impressora — escolha das sub-redes a varrer.
 *
 * Mora aqui (e não em agente-impressao/) porque só o workspace do backend roda
 * na CI; um teste dentro da pasta do agente nunca seria executado.
 *
 * Caso real que motivou: no PC do caixa existe um adaptador virtual
 * ("Topaz Loopback") com IP PÚBLICO 54.232.189.113. O agente varria os 254
 * endereços dessa faixa — na internet — antes de olhar a rede da loja, e a
 * impressora (192.168.1.81) nunca era encontrada a tempo.
 */
const os = require('os');
const { subRedesLocais } = require('../../agente-impressao/agente.cjs');

// Espelha o que o PC do caixa realmente reporta.
const INTERFACES_DO_CAIXA = {
  'Topaz Loopback': [{ family: 'IPv4', address: '54.232.189.113', internal: false }],
  'Conexão Local* 2': [{ family: 'IPv4', address: '169.254.143.220', internal: false }],
  'Conexão Local* 1': [{ family: 'IPv4', address: '169.254.53.228', internal: false }],
  'Wi-Fi': [{ family: 'IPv4', address: '192.168.1.83', internal: false }],
  Ethernet: [{ family: 'IPv4', address: '169.254.1.249', internal: false }],
  'Loopback Pseudo-Interface 1': [{ family: 'IPv4', address: '127.0.0.1', internal: true }],
};

function comInterfaces(mapa, fn) {
  const spy = jest.spyOn(os, 'networkInterfaces').mockReturnValue(mapa);
  try {
    return fn();
  } finally {
    spy.mockRestore();
  }
}

describe('subRedesLocais', () => {
  it('não varre faixas públicas da internet', () => {
    const bases = comInterfaces(INTERFACES_DO_CAIXA, subRedesLocais);
    expect(bases).not.toContain('54.232.189');
  });

  it('não varre link-local (169.254.x: placa sem DHCP)', () => {
    const bases = comInterfaces(INTERFACES_DO_CAIXA, subRedesLocais);
    expect(bases.filter((b) => b.startsWith('169.254'))).toHaveLength(0);
  });

  it('varre a rede da loja, onde a impressora está', () => {
    const bases = comInterfaces(INTERFACES_DO_CAIXA, subRedesLocais);
    expect(bases).toEqual(['192.168.1']);
  });

  it('aceita as três faixas privadas da RFC1918', () => {
    const bases = comInterfaces(
      {
        a: [{ family: 'IPv4', address: '10.0.0.5', internal: false }],
        b: [{ family: 'IPv4', address: '172.20.3.9', internal: false }],
        c: [{ family: 'IPv4', address: '192.168.0.4', internal: false }],
      },
      subRedesLocais
    );
    expect(bases.sort()).toEqual(['10.0.0', '172.20.3', '192.168.0']);
  });

  it('não confunde 172.32.x (pública) com a faixa privada 172.16-31.x', () => {
    const bases = comInterfaces(
      {
        forra: [{ family: 'IPv4', address: '172.32.0.10', internal: false }],
        dentro: [{ family: 'IPv4', address: '172.31.255.10', internal: false }],
      },
      subRedesLocais
    );
    expect(bases).toEqual(['172.31.255']);
  });
});
