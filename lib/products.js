import fs from "fs";
import path from "path";
import { detectDelimiter, parseLine } from "./csv.js";
import { norm, tokens } from "./utils.js";
import { readJson } from "./data-loader.js";

const PRODUCT_FILE = path.join(process.cwd(), "data", "produtos.csv");

let productCache = null;

function normalizeProductDescription(description) {
  let text = norm(description);

  text = text
    .replace(/\bFLEX\b/g, "FLEXIVEL")
    .replace(/\bCABO FLEX\b/g, "CABO FLEXIVEL")
    .replace(/\bDISJ\b/g, "DISJUNTOR")
    .replace(/\bBIP\b/g, "BIPOLAR")
    .replace(/\bBI\b/g, "BIPOLAR")
    .replace(/\bTRI\b/g, "TRIPOLAR")
    .replace(/\b2 POLOS\b/g, "2 X")
    .replace(/\bDOIS POLOS\b/g, "2 X")
    .replace(/\b3 POLOS\b/g, "3 X")
    .replace(/\bTRES POLOS\b/g, "3 X")
    .replace(/\bTRÊS POLOS\b/g, "3 X")
    .replace(/\s+/g, " ")
    .trim();

  return text;
}

export function loadProducts() {
  if (productCache) return productCache;

  if (!fs.existsSync(PRODUCT_FILE)) {
    productCache = [];
    return productCache;
  }

  const raw = fs.readFileSync(PRODUCT_FILE, "utf8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());

  if (!lines.length) {
    productCache = [];
    return productCache;
  }

  const delimiter = detectDelimiter(lines[0]);
  const header = parseLine(lines[0], delimiter).map((h) => norm(h));
  let descIndex = header.findIndex((h) => ["DESCRICAO", "DESCRIÇÃO", "PRODUTO", "ITEM", "NOME"].includes(h));
  let unitIndex = header.findIndex((h) => ["UNIDADE", "UN"].includes(h));

  if (descIndex < 0) descIndex = 0;
  if (unitIndex < 0) unitIndex = 1;

  productCache = lines.slice(1).map((line, index) => {
    const cols = parseLine(line, delimiter);
    const descricao = String(cols[descIndex] || cols[0] || "").trim();
    const unidade = String(cols[unitIndex] || cols[1] || "").trim();

    return {
      id: index + 1,
      descricao,
      unidade,
      normalized: normalizeProductDescription(descricao),
      tokenSet: new Set(tokens(descricao))
    };
  }).filter((p) => p.descricao);

  return productCache;
}

function expandQuery(query) {
  const sinonimos = readJson("sinonimos.json", {});
  const q = normalizeProductDescription(query);
  const expansions = new Set([q]);

  for (const [key, values] of Object.entries(sinonimos)) {
    const k = normalizeProductDescription(key);
    if (q.includes(k)) {
      values.forEach((v) => expansions.add(normalizeProductDescription(v)));
    }

    for (const value of values) {
      const v = normalizeProductDescription(value);
      if (q.includes(v)) expansions.add(k);
    }
  }

  // Patterns for common electrical terms
  const cableGauge = q.match(/\b(?:CABO|FIO|CONDUTOR)?\s*(?:FLEXIVEL|FLEX)?\s*(\d+(?:\.\d+)?)\s*MM\b/);
  if (cableGauge) {
    const g = cableGauge[1];
    expansions.add(`CABO FLEXIVEL ${g}MM`);
    expansions.add(`CABO FLEX ${g}MM`);
    expansions.add(`CABO ${g}MM`);
    expansions.add(`FIO ${g}MM`);
    expansions.add(`CONDUTOR ${g}MM`);
  }

  const disjAmp = q.match(/\b(?:DISJUNTOR|DISJ)?(?:\s+(BIPOLAR|TRIPOLAR|2 X|3 X|2P|3P))?\s*(\d{1,4})A\b/);
  const disjAmpLoose = q.match(/\b(\d{1,4})A\b/);
  if (q.includes("DISJUNTOR") || q.includes("DISJ")) {
    const amp = disjAmp?.[2] || disjAmpLoose?.[1] || "";
    const pole = q.includes("TRIPOLAR") || q.includes("3 X") || q.includes("3P")
      ? "3 X"
      : (q.includes("BIPOLAR") || q.includes("2 X") || q.includes("2P") ? "2 X" : "");

    if (amp) {
      expansions.add(`DISJUNTOR ${amp}A`);
      if (pole === "2 X") {
        expansions.add(`DISJUNTOR BIPOLAR ${amp}A`);
        expansions.add(`DISJUNTOR DIN 2 X ${amp}A`);
        expansions.add(`DISJUNTOR NEMA BIPOLAR ${amp}A`);
      }
      if (pole === "3 X") {
        expansions.add(`DISJUNTOR TRIPOLAR ${amp}A`);
        expansions.add(`DISJUNTOR DIN 3 X ${amp}A`);
        expansions.add(`DISJUNTOR NEMA TRIPOLAR ${amp}A`);
      }
    }
  }

  return [...expansions].filter(Boolean);
}

function scoreProduct(product, query) {
  const q = normalizeProductDescription(query);
  const qTokens = tokens(q);
  let score = 0;

  if (!q) return 0;
  if (product.normalized === q) score += 500;
  if (product.normalized.includes(q)) score += 250;
  if (q.includes(product.normalized) && product.normalized.length > 5) score += 140;

  for (const token of qTokens) {
    if (product.tokenSet.has(token)) score += 22;
    else if (product.normalized.includes(token)) score += 12;
  }

  // Cable-specific bonuses
  const gauge = q.match(/\b(\d+(?:\.\d+)?)MM\b/)?.[1];
  if (gauge && product.normalized.includes(`${gauge}MM`)) score += 90;
  if ((q.includes("CABO") || q.includes("FIO") || q.includes("CONDUTOR")) && product.normalized.includes("CABO")) score += 50;
  if ((q.includes("FLEXIVEL") || q.includes("FLEX")) && product.normalized.includes("FLEX")) score += 45;

  // Disjuntor-specific bonuses
  const amp = q.match(/\b(\d{1,4})A\b/)?.[1];
  if (amp && product.normalized.includes(`${amp}A`)) score += 90;
  if ((q.includes("DISJUNTOR") || q.includes("DISJ")) && product.normalized.includes("DISJUNTOR")) score += 80;
  if ((q.includes("BIPOLAR") || q.includes("2 X") || q.includes("2P")) && (product.normalized.includes("BIPOLAR") || product.normalized.includes("2 X"))) score += 80;
  if ((q.includes("TRIPOLAR") || q.includes("3 X") || q.includes("3P")) && (product.normalized.includes("TRIPOLAR") || product.normalized.includes("3 X"))) score += 80;

  // Penalize wrong type
  if (q.includes("DISJUNTOR") && !product.normalized.includes("DISJUNTOR")) score -= 60;
  if ((q.includes("CABO") || q.includes("FIO")) && !product.normalized.includes("CABO")) score -= 40;

  return score;
}

export function searchProducts(query, limit = Number(process.env.MAX_PRODUCT_MATCHES || 12)) {
  const products = loadProducts();
  const queries = expandQuery(query);
  const minScore = Number(process.env.MIN_MATCH_SCORE || 22);
  const best = new Map();

  for (const product of products) {
    let score = 0;

    for (const q of queries) {
      score = Math.max(score, scoreProduct(product, q));
    }

    if (score >= minScore) {
      const existing = best.get(product.descricao);
      if (!existing || score > existing.score) {
        best.set(product.descricao, { ...product, score });
      }
    }
  }

  return [...best.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ descricao, unidade, score }) => ({ descricao, unidade, score }));
}

export function validateItems(items = []) {
  return items.map((item) => {
    const matches = searchProducts(item.descricao || item.item || item.produto || "");
    return {
      descricao: item.descricao || item.item || item.produto || "",
      quantidade: item.quantidade || "",
      unidadeSolicitada: item.unidadeSolicitada || "",
      trabalhamos: matches.length > 0,
      encontrados: matches.slice(0, 5).map((m) => m.descricao),
      melhorResultado: matches[0]?.descricao || "",
      unidadeCatalogo: matches[0]?.unidade || "",
      score: matches[0]?.score || 0,
      observacao: matches.length
        ? "Encontrado no catálogo. Não informar preço, estoque ou prazo."
        : "Não localizado com segurança. Vendedor deve confirmar."
    };
  });
}
