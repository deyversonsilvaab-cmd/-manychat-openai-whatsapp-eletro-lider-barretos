import fs from "fs";
import path from "path";
import { clean, nowIso } from "./utils.js";

const MEMORY_DIR = path.join(process.cwd(), "memory");

function safeKey(value) {
  return String(value || "anonimo").replace(/[^\w.-]/g, "_").slice(0, 80);
}

export function loadMemory(phoneOrId) {
  try {
    const file = path.join(MEMORY_DIR, `${safeKey(phoneOrId)}.json`);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

export function saveMemory(phoneOrId, data) {
  try {
    if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR, { recursive: true });
    const file = path.join(MEMORY_DIR, `${safeKey(phoneOrId)}.json`);
    fs.writeFileSync(file, JSON.stringify({ ...data, updatedAt: nowIso() }, null, 2), "utf8");
    return true;
  } catch (error) {
    console.error("memory save error", error?.message || error);
    return false;
  }
}

export function buildMemoryContext({ existing, name, phone, summary, items }) {
  return {
    nome: clean(name) || existing?.nome || "",
    telefone: clean(phone) || existing?.telefone || "",
    resumo: clean(summary) || existing?.resumo || "",
    itens: Array.isArray(items) && items.length ? items : (existing?.itens || []),
    conversas: existing?.conversas || []
  };
}
