import fs from "fs";
import path from "path";

const PRODUCT_FILE = path.join(process.cwd(), "data", "produtos.csv");

let cache = null;

function removeAccents(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizeText(text) {
  return removeAccents(text)
    .toLowerCase()
    .replace(/[^\w\s\/\-\.\,\(\)"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectDelimiter(firstLine) {
  const semicolon = (firstLine.match(/;/g) || []).length;
  const comma = (firstLine.match(/,/g) || []).length;
  return semicolon >= comma ? ";" : ",";
}

function parseCsvLine(line, delimiter) {
  const result = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && next === '"') {
      current += '"';
      i++;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === delimiter && !insideQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

export function loadProducts() {
  if (cache) return cache;

  if (!fs.existsSync(PRODUCT_FILE)) {
    cache = [];
    return cache;
  }

  const raw = fs.readFileSync(PRODUCT_FILE, "utf8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());

  if (!lines.length) {
    cache = [];
    return cache;
  }

  const delimiter = detectDelimiter(lines[0]);
  const header = parseCsvLine(lines[0], delimiter).map((h) => normalizeText(h));

  const descriptionIndex =
    header.findIndex((h) => ["descricao", "descrição", "produto", "nome", "item", "descricao produto"].includes(h)) >= 0
      ? header.findIndex((h) => ["descricao", "descrição", "produto", "nome", "item", "descricao produto"].includes(h))
      : 0;

  const products = [];

  for (const line of lines.slice(1)) {
    const columns = parseCsvLine(line, delimiter);
    const description = String(columns[descriptionIndex] || columns[0] || "").trim();

    if (!description) continue;

    products.push({
      descricao: description,
      normalized: normalizeText(description)
    });
  }

  cache = products;
  return cache;
}

export function searchProducts(query, limit = 8) {
  const products = loadProducts();
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery || normalizedQuery.length < 2) {
    return [];
  }

  const queryTerms = normalizedQuery
    .split(" ")
    .filter((term) => term.length >= 2);

  const scored = products
    .map((product) => {
      let score = 0;

      if (product.normalized === normalizedQuery) score += 100;
      if (product.normalized.includes(normalizedQuery)) score += 60;

      for (const term of queryTerms) {
        if (product.normalized.includes(term)) score += 10;
      }

      return {
        descricao: product.descricao,
        score
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((item) => item.descricao);
}

export function checkItemsAvailability(items = []) {
  return items.map((item) => {
    const description = typeof item === "string" ? item : item.descricao || item.produto || "";
    const matches = searchProducts(description, 5);

    return {
      item: description,
      trabalhamos: matches.length > 0,
      encontrados: matches
    };
  });
}
