import { cleanText } from "./utils.js";
export function extractLikelyItems(message) {
  const text = cleanText(message);
  if (!text) return [];
  const lines = text.split(/\n|;/).map((x)=>x.trim()).filter(Boolean);
  const chunks = lines.length > 1 ? lines : text.split(/,(?=\s*\d|\s*[a-zA-ZÀ-ÿ])/).map((x)=>x.trim()).filter(Boolean);
  return chunks.slice(0,50).map((line)=>{
    const cleaned = line.replace(/^[-•*]\s*/, "");
    const qtd = cleaned.match(/(\d+[\.,]?\d*)\s*(m|mt|mts|metro|metros|un|und|unid|unidade|unidades|pc|pcs|peça|peças|rolo|rolos|barra|barras|caixa|cx)?/i);
    return { descricao: cleaned, quantidade: qtd ? qtd[0] : "" };
  }).filter((i)=>i.descricao.length>=3);
}
export function mergeItems(previous = [], current = []) {
  const map = new Map();
  for (const item of [...previous, ...current]) {
    const descricao = cleanText(item.descricao || item.produto || item.item);
    if (!descricao) continue;
    const key = descricao.toLowerCase();
    const existing = map.get(key);
    if (existing) { if (!existing.quantidade && item.quantidade) existing.quantidade = item.quantidade; }
    else map.set(key, { descricao, quantidade: cleanText(item.quantidade), trabalhamos: Boolean(item.trabalhamos), observacao: cleanText(item.observacao) });
  }
  return [...map.values()];
}
