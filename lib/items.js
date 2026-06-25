import { clean, norm } from "./utils.js";

export function extractItems(message) {
  const text = clean(message);
  if (!text) return [];

  const lines = text.split(/\n|;/).map((x) => x.trim()).filter(Boolean);
  const chunks = lines.length > 1
    ? lines
    : text.split(/,(?=\s*\d|\s*[a-zA-ZÀ-ÿ])/).map((x) => x.trim()).filter(Boolean);

  return chunks.slice(0, 150).map((line) => {
    const descricao = line.replace(/^[-•*]\s*/, "");
    const quantity = descricao.match(/(\d+[\.,]?\d*)\s*(m|mt|mts|metro|metros|un|und|unid|unidade|unidades|pc|pcs|peça|peças|rolo|rolos|barra|barras|caixa|cx)?/i);

    return {
      descricao,
      quantidade: quantity ? quantity[0] : ""
    };
  }).filter((item) => item.descricao.length >= 3);
}

export function mergeItems(previous = [], current = []) {
  const map = new Map();

  for (const item of [...previous, ...current]) {
    const descricao = clean(item.descricao || item.produto || item.item);
    if (!descricao) continue;

    const key = norm(descricao);
    const existing = map.get(key);

    if (existing) {
      if (!existing.quantidade && item.quantidade) existing.quantidade = clean(item.quantidade);
      if (item.trabalhamos) existing.trabalhamos = true;
      if (item.observacao) existing.observacao = clean(item.observacao);
    } else {
      map.set(key, {
        descricao,
        quantidade: clean(item.quantidade),
        trabalhamos: Boolean(item.trabalhamos),
        observacao: clean(item.observacao)
      });
    }
  }

  return [...map.values()].slice(0, Number(process.env.MAX_CART_ITEMS || 100));
}

export function customerClosedCart(message) {
  const text = norm(message);

  return [
    "mais nada",
    "so isso",
    "só isso",
    "pode fechar",
    "finalizar",
    "mandar vendedor",
    "pode mandar",
    "quero comprar",
    "só esses",
    "so esses",
    "fecha pra mim"
  ].some((term) => text.includes(norm(term)));
}
