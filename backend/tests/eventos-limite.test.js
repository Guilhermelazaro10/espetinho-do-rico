const http = require('http');
const app = require('../src/app');
const { MAX_CONEXOES_POR_IP } = require('../src/routes/eventos.routes');

/*
 * O stream SSE é público (EventSource não manda header de login). Sem teto,
 * um script abria milhares de conexões e cada uma segura um socket e um
 * ouvinte no barramento até o servidor cair. O teto é por IP e folgado: na
 * VPS a equipe inteira chega pelo mesmo IP do Wi-Fi da loja, e cada tela do
 * PDV abre duas conexões.
 */

let servidor;
let porta;
const abertas = [];

beforeAll((pronto) => {
  servidor = http.createServer(app).listen(0, () => {
    porta = servidor.address().port;
    pronto();
  });
});

afterEach(() => {
  while (abertas.length) abertas.pop().destroy();
});

afterAll((pronto) => {
  servidor.closeAllConnections?.();
  servidor.close(pronto);
});

// Abre uma conexão SSE e resolve com o status assim que chegam os headers.
function conectar() {
  return new Promise((resolve, reject) => {
    const req = http.get({ port: porta, path: '/api/eventos' }, (res) => {
      abertas.push(req);
      resolve({ status: res.statusCode, fechar: () => req.destroy() });
      res.resume();
    });
    req.on('error', (e) => (e.code === 'ECONNRESET' ? null : reject(e)));
  });
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

describe('/api/eventos: teto de conexões simultâneas por IP', () => {
  it('teto folgado para a loja inteira atrás de um IP', () => {
    expect(MAX_CONEXOES_POR_IP).toBe(40);
  });

  it('conexão além do teto recebe 429; ao fechar uma, abre vaga', async () => {
    const conexoes = [];
    for (let i = 0; i < MAX_CONEXOES_POR_IP; i++) conexoes.push(await conectar());
    expect(conexoes.every((c) => c.status === 200)).toBe(true);

    expect((await conectar()).status).toBe(429);

    conexoes[0].fechar();
    await esperar(50); // o servidor processa o 'close'
    expect((await conectar()).status).toBe(200);
  });
});
