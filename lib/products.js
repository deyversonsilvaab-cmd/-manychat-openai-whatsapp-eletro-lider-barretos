import fs from "fs";
import path from "path";
import { detectDelimiter, parseLine } from "./csv.js";
import { norm } from "./utils.js";
import { loadData } from "./data-loader.js";

const FILE = path.join(process.cwd(), "data", "produtos.csv");
let cache = null;

export function loadProducts() {
  if (cache) return cache;

  if (!fs.existsSync(FILE)) {
    cache = [];
    return cache;
  }

  const raw = fs.readFileSync(FILE, "utf8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter((x) => x.trim());

  if (!lines.length) {
    cache = [];
    return cache;
  }

  const delimiter = detectDelimiter(lines[0]);
  const header = parseLine(lines[0], delimiter).map(norm);
  let descriptionIndex = header.findIndex((x) =>
    ["descricao", "descrição", "produto", "nome", "item", "descricao produto"].includes(x)
  );

  if (descriptionIndex < 0) descriptionIndex = 0;

  cache = lines.slice(1).map((line) => {
    const columns = parseLine(line, delimiter);
    const descricao = String(columns[descriptionIndex] || columns[0] || "").trim();

    return {
      descricao,
      normalized: norm(columns.join(" "))
    };
  }).filter((p) => p.descricao);

  return cache;
}

function expandQuery(query) {
  const data = loadData();
  const normalized = norm(query);
  const expanded = [normalized];

  for (const [key, values] of Object.entries(data.sinonimos || {})) {
    const keyNorm = norm(key);
    if (normalized.includes(keyNorm)) {
      values.forEach((value) => expanded.push(norm(value)));
    }

    for (const value of values) {
      const valueNorm = norm(value);
      if (normalized.includes(valueNorm)) expanded.push(keyNorm);
    }
  }

  for (const words of Object.values(data.categorias || {})) {
    for (const word of words) {
      if (normalized.includes(norm(word))) {
        words.forEach((item) => expanded.push(norm(item)));
      }
    }
  }

  return [...new Set(expanded)].filter(Boolean);
}

export function searchProducts(query, limit = 15) {
  const queries = expandQuery(query);
  const scored = new Map();

  for (const product of loadProducts()) {
    let score = 0;

    for (const query of queries) {
      if (!query || query.length < 2) continue;

      if (product.normalized === query) score += 150;
      if (product.normalized.includes(query)) score += 80;

      for (const term of query.split(" ").filter((x) => x.length >= 2)) {
        if (product.normalized.includes(term)) score += 12;
      }
    }

    if (score > 0) {
      const current = scored.get(product.descricao);
      if (!current || score > current.score) {
        scored.set(product.descricao, { descricao: product.descricao, score });
      }
    }
  }

  return [...scored.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.descricao);
}

export function checkProducts(items = []) {
  return items.map((item) => {
    const descricao = typeof item === "string" ? item : (item.descricao || item.produto || item.item || "");
    const encontrados = searchProducts(descricao, Number(process.env.MAX_PRODUCT_MATCHES || 15));

    return {
      descricao,
      quantidade: item.quantidade || "",
      trabalhamos: encontrados.length > 0,
      encontrados,
      observacao: encontrados.length
        ? "Item localizado na base. Não informar estoque, preço ou prazo."
        : "Item não localizado na base. Confirmar com vendedor."
    };
  });
}
