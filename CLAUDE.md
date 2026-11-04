# Contexto para agentes de IA

PDV em **produção** do Espetinho do Rico (Jaguaruana/CE). Mexe com dinheiro
real todo dia — bug aqui vira troco errado no caixa.

Leia [`CONTRIBUTING.md`](CONTRIBUTING.md) antes de mudar código: ele tem as
regras invioláveis do domínio. Resumo do que mais quebra quem chega agora:

1. **Dinheiro é inteiro em centavos** (`R$ 12,50` = `1250`). Nunca float.
2. **O servidor calcula o total**; o cliente só manda quais itens. O preço
   unitário é congelado na venda.
3. **Soft delete sempre** (`ativo: false`). Apagar linha quebra relatório.
4. **Dinheiro e correção são do gerente** (`somenteGerente`).
5. **Ação sensível vai para a auditoria** (`auditoriaService.registrar`).
6. **Fuso é o da loja** (`America/Fortaleza`), nunca o do servidor/aparelho.
7. **Schema só muda por migration** (`prisma migrate dev`).

## Comandos

```bash
npm run verificar        # lint + testes + build (o mesmo que a CI roda)
npm run dev:backend      # API  :3001
npm run dev:frontend     # UI   :5173
```

## Arquitetura em uma linha

Rotas (finas) → `services/` (regra de negócio, fonte de verdade) → Prisma →
SQLite. Tempo real por SSE em `/api/eventos`. Frontend React servido pelo
próprio backend em produção.

## Frontend: escala de texto remapeada

Os nomes de tamanho do Tailwind **não** valem o padrão: foram remapeados em
`frontend/src/index.css` (`@theme`) para a escala da marca
(12 · 13 · 15 · 17 · 20 · 24 · 32 · 40px).

| Classe | Tamanho | Uso |
|---|---|---|
| `text-xs` | 12px | selo, metadado — mínimo absoluto |
| `text-rotulo` | 13px | rótulo (sentence case, 600, `carvao-suave`) |
| `text-sm` | **15px** | corpo, botões, campos (padrão do `body`) |
| `text-base` / `text-lg` | 17px | nome em destaque |
| `text-xl` | 20px | título de seção/sheet |
| `text-2xl` | 24px | título de página |
| `text-3xl` | 32px | número da mesa |
| `text-4xl` / `text-5xl` | 40px | total a pagar |

Raios também: `rounded-lg` = 10px (controle), `rounded-xl`/`2xl` = 14px
(card), `rounded-3xl` = 20px (sheet). Sombras: só `shadow-suave` e
`shadow-media`. Cor de estado: `ok`, `atencao`, `erro` (nunca `emerald-*` ou
`amber-*`). Não use `text-[11px]` e afins: abaixo de 12px é proibido.

## Ao corrigir bug

Escreva primeiro o teste que falha, confirme que ele reprova o código atual e
só então corrija. Testes do backend usam Prisma mockado (rápidos, sem banco).
