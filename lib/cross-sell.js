import { norm } from "./utils.js";
import { readJson } from "./data-loader.js";

export function crossSell(items = []) {
  const rules = readJson("cross-sell.json", {});
  const suggestions = new Set();

  for (const item of items) {
    const text = norm(item.descricao);

    for (const [key, values] of Object.entries(rules)) {
      if (text.includes(norm(key))) {
        values.forEach((v) => suggestions.add(v));
      }
    }
  }

  return [...suggestions].slice(0, 6);
}
