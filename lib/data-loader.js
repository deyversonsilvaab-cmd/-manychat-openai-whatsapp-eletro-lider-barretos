import fs from "fs";
import path from "path";

const DATA = path.join(process.cwd(), "data");
const PROMPTS = path.join(process.cwd(), "prompts");

function json(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA, name), "utf8"));
  } catch {
    return fallback;
  }
}

function text(name, fallback = "") {
  try {
    return fs.readFileSync(path.join(PROMPTS, name), "utf8");
  } catch {
    return fallback;
  }
}

export function loadData() {
  return {
    loja: json("loja.json", {}),
    politicas: json("politicas.json", {}),
    sinonimos: json("sinonimos.json", {}),
    categorias: json("categorias.json", {}),
    marcas: json("marcas.json", {}),
    crossSell: json("cross-sell.json", {}),
    campanhas: json("campanhas.json", {}),
    sazonalidade: json("sazonalidade.json", {}),
    faq: json("faq.json", []),
    gating: json("gating.json", {}),
    prompts: {
      system: text("system.txt"),
      vendedor: text("vendedor.txt"),
      entrega: text("entrega.txt"),
      ocr: text("ocr.txt"),
      crossSell: text("cross-sell.txt"),
      memoria: text("memoria.txt")
    }
  };
}
