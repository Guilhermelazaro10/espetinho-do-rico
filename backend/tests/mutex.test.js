const { criarMutex } = require('../src/lib/mutex');

describe('criarMutex — serializa seções críticas', () => {
  it('roda as seções uma de cada vez, sem intercalar', async () => {
    const mutex = criarMutex();
    const ordem = [];
    const secao = (nome) => async () => {
      ordem.push(`${nome}:in`);
      await new Promise((r) => setTimeout(r, 10));
      ordem.push(`${nome}:out`);
      return nome;
    };

    const resultado = await Promise.all([mutex(secao('A')), mutex(secao('B')), mutex(secao('C'))]);

    expect(resultado).toEqual(['A', 'B', 'C']);
    // cada uma termina (:out) antes da próxima começar (:in) — sem corrida
    expect(ordem).toEqual(['A:in', 'A:out', 'B:in', 'B:out', 'C:in', 'C:out']);
  });

  it('um erro numa seção não trava as seguintes', async () => {
    const mutex = criarMutex();
    await expect(mutex(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    await expect(mutex(() => Promise.resolve('ok'))).resolves.toBe('ok');
  });
});
