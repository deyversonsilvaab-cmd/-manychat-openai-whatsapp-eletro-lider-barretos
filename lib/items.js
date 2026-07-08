import { clean, norm } from "./utils.js";

function normalizeQtyUnit(raw = "") {
  const r = String(raw || "").toLowerCase();
  if (r.includes("metro") || /\bm\b/.test(r)) return "MT";
  if (r.includes("unidade") || /\bun\b/.test(r) || /\bpc\b/.test(r) || r.includes("peça")) return "PC";
  return "";
}

function addUnique(items, item) {
  const desc = clean(item.descricao);
  if (!desc) return;
  const key = norm(desc);
  if (items.some((x) => norm(x.descricao) === key)) return;
  items.push({ ...item, descricao: desc });
}

function extractCableItems(text) {
  const items = [];
  const patterns = [
    /(?:(\d+(?:[.,]\d+)?)\s*(metros?|mts?|m)\s*(?:de)?\s*)?(?:cabo|cabos|fio|fios|condutor|condutores)\s*(?:flex(?:ivel|ível)?\s*)?(\d+(?:[.,]\d+)?)\s*(?:mm2|mm²|mm)?/gi,
    /(?:cabo|cabos|fio|fios|condutor|condutores)\s*(?:flex(?:ivel|ível)?\s*)?(\d+(?:[.,]\d+)?)\s*(?:mm2|mm²|mm)?(?:\s*(?:com|de)?\s*(\d+(?:[.,]\d+)?)\s*(metros?|mts?|m))?/gi
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      let quantidade = "";
      let gauge = "";

      if (match.length >= 4 && match[3]) {
        quantidade = match[1] ? `${match[1].replace(",", ".")} ${normalizeQtyUnit(match[2]) || "MT"}` : "";
        gauge = match[3].replace(",", ".");
      } else {
        gauge = match[1]?.replace(",", ".") || "";
        quantidade = match[2] ? `${match[2].replace(",", ".")} ${normalizeQtyUnit(match[3]) || "MT"}` : "";
      }

      if (gauge) {
        addUnique(items, {
          descricao: `CABO FLEXIVEL ${gauge}MM`,
          quantidade,
          unidadeSolicitada: quantidade.includes("MT") ? "MT" : ""
        });
      }
    }
  }

  return items;
}

function extractDisjuntorItems(text) {
  const items = [];

  const patterns = [
    // Ex: 2 disjuntores bipolar 40A / 2 disjuntor bipolar 40A
    /(?:(\d+)\s*(?:un|und|unid|unidade|unidades|pcs?|peças?)?\s*(?:de)?\s*)?(?:disj(?:untor|untores)?\.?|disjuntores)\s*(?:(bipolar|bipolares|tripolar|tripolares|unipolar|unipolares|2p|3p|1p|2\s*x|3\s*x|1\s*x)\s*)?(\d{1,4})\s*a\b/gi,

    // Ex: disj bipolar de 40 amperes / disjuntores 2p 40
    /(?:(\d+)\s*)?(?:disj(?:untor|untores)?\.?|disjuntores)\s*(?:(bipolar|bipolares|tripolar|tripolares|unipolar|unipolares|2p|3p|1p|2\s*x|3\s*x|1\s*x)\s*)?(?:de\s*)?(\d{1,4})\s*(?:amp|amperes|a)?\b/gi
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const qtd = match[1] ? `${match[1]} PC` : "";
      const poleRaw = String(match[2] || "").toLowerCase().replace(/\s+/g, "");
      const amp = match[3];

      if (!amp) continue;

      let desc = `DISJUNTOR ${amp}A`;
      if (poleRaw.includes("bipolar") || poleRaw.includes("bipolares") || poleRaw === "2p" || poleRaw === "2x") desc = `DISJUNTOR BIPOLAR ${amp}A`;
      if (poleRaw.includes("tripolar") || poleRaw.includes("tripolares") || poleRaw === "3p" || poleRaw === "3x") desc = `DISJUNTOR TRIPOLAR ${amp}A`;
      if (poleRaw.includes("unipolar") || poleRaw.includes("unipolares") || poleRaw === "1p" || poleRaw === "1x") desc = `DISJUNTOR UNIPOLAR ${amp}A`;

      addUnique(items, {
        descricao: desc,
        quantidade: qtd,
        unidadeSolicitada: "PC"
      });
    }
  }

  return items;
}

function fallbackListExtraction(text) {
  const items = [];
  const parts = String(text || "")
    .split(/\n|;|,(?=\s*\d|\s*(?:cabo|fio|disj|tomada|lampada|lâmpada|refletor|chuveiro|ventilador))/i)
    .map((p) => p.trim())
    .filter(Boolean);

  for (const part of parts) {
    if (part.length < 3) continue;
    if (/^(oi|ola|olá|bom dia|boa tarde|boa noite)$/i.test(part)) continue;

    const quantity = part.match(/\b(\d+(?:[.,]\d+)?)\s*(metros?|mts?|m|un|und|unid|pc|pcs|peças?)\b/i);
    addUnique(items, {
      descricao: part.replace(/^(oi|ola|olá|bom dia|boa tarde|boa noite)[,\s]*/i, "").trim(),
      quantidade: quantity ? `${quantity[1].replace(",", ".")} ${normalizeQtyUnit(quantity[2])}`.trim() : "",
      unidadeSolicitada: quantity ? normalizeQtyUnit(quantity[2]) : ""
    });
  }

  return items;
}

export function extractItems(message = "") {
  const text = clean(message);
  const items = [];

  for (const item of extractCableItems(text)) addUnique(items, item);
  for (const item of extractDisjuntorItems(text)) addUnique(items, item);

  if (!items.length) {
    for (const item of fallbackListExtraction(text)) addUnique(items, item);
  }

  return items.slice(0, 80);
}

export function mergeItems(previous = [], current = []) {
  const out = [];

  for (const item of [...previous, ...current]) {
    const descricao = clean(item.descricao || item.produto || item.item);
    if (!descricao) continue;
    if (descricao.includes("{") || descricao.includes("}")) continue; // ignora placeholders/variaveis nao resolvidas (bug de merge permanente)

    const existing = out.find((x) => norm(x.descricao) === norm(descricao));
    if (existing) {
      if (!existing.quantidade && item.quantidade) existing.quantidade = item.quantidade;
      continue;
    }

    out.push({
      descricao,
      quantidade: clean(item.quantidade),
      unidadeSolicitada: clean(item.unidadeSolicitada)
    });
  }

  return out.slice(0, 100);
}

export function customerLikelyFinished(message = "") {
  const text = norm(message);
  return [
    "SO ISSO", "SÓ ISSO", "MAIS NADA", "PODE FECHAR", "FECHA", "FINALIZAR",
    "QUERO COMPRAR", "PODE MANDAR", "ORCAMENTO", "ORÇAMENTO", "COTACAO", "COTAÇÃO"
  ].some((term) => text.includes(norm(term)));
}

export function needsDeliveryQuestion(message = "") {
  const text = norm(message);
  return text.includes("ENTREGA") || text.includes("ENTREGAR") || text.includes("RETIRADA") || text.includes("RETIRAR");
}
