import fs from "fs";
import path from "path";
const DATA_DIR = path.join(process.cwd(), "data");
const PROMPTS_DIR = path.join(process.cwd(), "prompts");
function readJson(name, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf8")); } catch { return fallback; }
}
function readText(name, fallback = "") {
  try { return fs.readFileSync(path.join(PROMPTS_DIR, name), "utf8"); } catch { return fallback; }
}
export function loadKnowledge() {
  return {
    politicas: readJson("politicas.json", {}),
    enderecos: readJson("enderecos.json", {}),
    vendedores: readJson("vendedores.json", {}),
    sinonimos: readJson("sinonimos.json", {}),
    campanhas: readJson("campanhas.json", {}),
    faq: readJson("faq.json", []),
    sazonalidade: readJson("sazonalidade.json", {}),
    prompts: { system: readText("system.txt"), vendedor: readText("vendedor.txt"), entrega: readText("entrega.txt") }
  };
}
