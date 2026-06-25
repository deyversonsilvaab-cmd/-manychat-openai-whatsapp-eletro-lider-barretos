import fs from "fs";
import path from "path";
import { detectDelimiter, parseCsvLine } from "./csv.js";
import { normalizeText } from "./utils.js";
import { loadKnowledge } from "./knowledge.js";
const PRODUCT_FILE = path.join(process.cwd(), "data", "produtos.csv");
let cache = null;
export function loadProducts() {
  if (cache) return cache;
  if (!fs.existsSync(PRODUCT_FILE)) { cache = []; return cache; }
  const raw = fs.readFileSync(PRODUCT_FILE, "utf8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) { cache = []; return cache; }
  const delimiter = detectDelimiter(lines[0]);
  const header = parseCsvLine(lines[0], delimiter).map((h) => normalizeText(h));
  const candidates = ["descricao", "descrição", "produto", "nome", "item", "descricao produto"];
  let idx = header.findIndex((h) => candidates.includes(h));
  if (idx < 0) idx = 0;
  cache = lines.slice(1).map((line) => {
    const cols = parseCsvLine(line, delimiter);
    const descricao = String(cols[idx] || cols[0] || "").trim();
    return { descricao, normalized: normalizeText(`${descricao} ${cols.join(" ")}`), raw: cols };
  }).filter((p) => p.descricao);
  return cache;
}
function expandQuery(query) {
  const knowledge = loadKnowledge();
  const normalized = normalizeText(query);
  const expansions = [normalized];
  for (const [key, values] of Object.entries(knowledge.sinonimos || {})) {
    const keyNorm = normalizeText(key);
    if (normalized.includes(keyNorm)) for (const v of values) expansions.push(normalizeText(v));
    for (const v of values) if (normalized.includes(normalizeText(v))) expansions.push(keyNorm);
  }
  return [...new Set(expansions)].filter(Boolean);
}
export function searchProducts(query, limit = 10) {
  const products = loadProducts();
  const queries = expandQuery(query);
  const scored = new Map();
  for (const p of products) {
    let score = 0;
    for (const q of queries) {
      if (!q || q.length < 2) continue;
      if (p.normalized === q) score += 120;
      if (p.normalized.includes(q)) score += 70;
      for (const term of q.split(" ").filter((t) => t.length >= 2)) if (p.normalized.includes(term)) score += 12;
    }
    if (score > 0) {
      const current = scored.get(p.descricao);
      if (!current || score > current.score) scored.set(p.descricao, { descricao: p.descricao, score });
    }
  }
  return Array.from(scored.values()).sort((a,b)=>b.score-a.score).slice(0, limit).map((x)=>x.descricao);
}
export function checkItems(items = []) {
  return items.map((item) => {
    const descricao = typeof item === "string" ? item : item.descricao || item.produto || "";
    const encontrados = searchProducts(descricao, Number(process.env.MAX_PRODUCT_MATCHES || 10));
    return { descricao, quantidade: item.quantidade || "", trabalhamos: encontrados.length > 0, encontrados };
  });
}
