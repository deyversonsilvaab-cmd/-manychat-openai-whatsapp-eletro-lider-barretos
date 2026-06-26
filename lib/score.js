import { norm } from "./utils.js";

export function leadScore({ message = "", items = [] }) {
  const text = norm(message);
  let score = 10;

  if (items.length) score += 35;
  if (items.length >= 2) score += 20;
  if (text.includes("ORCAMENTO") || text.includes("COTACAO")) score += 25;
  if (text.includes("COMPRAR") || text.includes("FECHAR")) score += 25;
  if (text.includes("ENTREGA") || text.includes("RETIRADA")) score += 10;
  if (text.includes("PRECO") || text.includes("VALOR")) score += 15;

  if (score >= 85) return "muito_quente";
  if (score >= 55) return "quente";
  if (score >= 25) return "morno";
  return "frio";
}

export function routeSeller({ message = "", items = [], score = "morno" }) {
  const text = norm(`${message} ${items.map((i) => i.descricao).join(" ")}`);

  if (text.includes("RIO PRETO")) {
    return { routeSellerId: "rio_preto", routeSellerName: "Rio Preto", routeQueue: "RIO_PRETO" };
  }

  if (text.includes("LUMINARIA") || text.includes("LED") || text.includes("FITA") || text.includes("PENDENTE")) {
    return { routeSellerId: "paula", routeSellerName: "Paula", routeQueue: "ILUMINACAO" };
  }

  if (text.includes("ELETRICISTA") || text.includes("CABO") || text.includes("DISJUNTOR") || text.includes("QUADRO")) {
    return { routeSellerId: "felipe", routeSellerName: "Felipe", routeQueue: "MATERIAL_ELETRICO" };
  }

  if (score === "muito_quente") {
    return { routeSellerId: "victor", routeSellerName: "Victor", routeQueue: "LEADS_QUENTES" };
  }

  return { routeSellerId: "jose_lucas", routeSellerName: "José Lucas", routeQueue: "GERAL" };
}
