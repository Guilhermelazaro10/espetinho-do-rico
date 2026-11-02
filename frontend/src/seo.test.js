import { describe, it, expect } from 'vitest';
import html from '../index.html?raw';

// A página que o Google e o WhatsApp leem é o index.html cru (não há SSR).
describe('SEO do index.html', () => {
  it('título do cardápio online', () => {
    expect(html).toContain('<title>Espetinho do Rico — Peça online | Delivery e Retirada</title>');
  });

  it('JSON-LD Restaurant com o endereço da loja', () => {
    const bloco = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(bloco).not.toBeNull();
    const dados = JSON.parse(bloco[1]);
    expect(dados['@type']).toBe('Restaurant');
    expect(dados.name).toBe('Espetinho do Rico');
    expect(dados.servesCuisine).toBe('Espetinhos');
    // mesmo endereço de backend/src/loja.js
    expect(dados.address.streetAddress).toBe('Rua Adolfo Francisco da Rocha, 608 — Bairro Juazeiro');
    expect(dados.address.addressLocality).toBe('Jaguaruana');
    expect(dados.address.addressRegion).toBe('CE');
  });
});
