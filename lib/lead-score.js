import { normalizeText } from "./utils.js";
export function calculateLeadScore({ message = "", items = [], intent = "" }) {
  const text = normalizeText(message);
  let score = 10;
  const rules = [["preco",10],["valor",10],["orcamento",30],["cotacao",30],["comprar",25],["pedido",20],["entrega",20],["retirada",10],["pix",10],["cartao",10],["eletricista",20],["obra",25],["empresa",25],["lista",20],["material",15]];
  for (const [term, points] of rules) if (text.includes(term)) score += points;
  if (items.length >= 2) score += 20;
  if (items.length >= 5) score += 30;
  if (["pedido_orcamento", "consulta_preco", "consulta_estoque"].includes(intent)) score += 25;
  if (score >= 90) return "muito_quente";
  if (score >= 60) return "quente";
  if (score >= 30) return "morno";
  return "frio";
}
