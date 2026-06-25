import { norm } from "./utils.js";

export function leadScore({ message = "", items = [], intent = "", hasAttachment = false }) {
  const text = norm(message);
  let score = hasAttachment ? 35 : 10;

  const rules = [
    ["preco", 10], ["valor", 10], ["orcamento", 30], ["orçamento", 30], ["cotacao", 30],
    ["comprar", 25], ["pedido", 20], ["entrega", 20], ["eletricista", 20], ["obra", 25],
    ["empresa", 25], ["lista", 20], ["material", 15], ["fechar", 35], ["urgente", 25],
    ["pdf", 25], ["foto", 20], ["imagem", 20], ["hoje", 10]
  ];

  for (const [term, points] of rules) {
    if (text.includes(norm(term))) score += points;
  }

  if (items.length >= 2) score += 20;
  if (items.length >= 5) score += 30;

  if (["pedido_orcamento", "consulta_preco", "consulta_estoque", "arquivo_orcamento"].includes(intent)) {
    score += 25;
  }

  if (score >= 90) return "muito_quente";
  if (score >= 60) return "quente";
  if (score >= 30) return "morno";
  return "frio";
}
