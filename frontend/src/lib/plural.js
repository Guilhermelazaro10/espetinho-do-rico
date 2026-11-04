// "1 item", "3 itens", "0 itens". Acaba com "item(ns)" e "pedido(s)" na tela.
// Com somentePalavra=true devolve só a palavra (para quando o número vem em
// outro elemento, ex.: dentro de um <b>).
export function plural(n, singular, pluralForma, somentePalavra = false) {
  const qtd = Number(n) || 0;
  const palavra = Math.abs(qtd) === 1 ? singular : pluralForma;
  return somentePalavra ? palavra : `${qtd} ${palavra}`;
}
