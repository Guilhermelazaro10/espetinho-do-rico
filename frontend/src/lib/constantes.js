// Espelho dos "enums" do backend (src/constantes.js)

export const PAPEIS = Object.freeze({ GERENTE: 'GERENTE', GARCOM: 'GARCOM' });

export const STATUS_MESA = Object.freeze({
  LIVRE: 'LIVRE',
  OCUPADA: 'OCUPADA',
  AGUARDANDO_PAGAMENTO: 'AGUARDANDO_PAGAMENTO',
});

export const TIPOS_PEDIDO = Object.freeze({
  MESA: 'MESA',
  DELIVERY: 'DELIVERY',
  BALCAO: 'BALCAO',
});

export const ehGerente = (sessao) => sessao?.usuario?.papel === PAPEIS.GERENTE;
