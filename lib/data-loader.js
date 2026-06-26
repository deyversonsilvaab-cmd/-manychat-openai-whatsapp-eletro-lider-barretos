import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const PROMPTS_DIR = path.join(process.cwd(), "prompts");

export function readJson(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf8"));
  } catch {
    return fallback;
  }
}

export function readText(file, fallback = "") {
  try {
    return fs.readFileSync(path.join(PROMPTS_DIR, file), "utf8");
  } catch {
    return fallback;
  }
}

export function loadKnowledge() {
  return {
    loja: readJson("loja.json", {}),
    politicas: readJson("politicas.json", {}),
    sinonimos: readJson("sinonimos.json", {}),
    crossSell: readJson("cross-sell.json", {}),
    faq: readJson("faq.json", []),
    systemPrompt: readText("system.txt", "")
  };
}
