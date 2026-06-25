import { norm } from "./utils.js";
import { loadData } from "./data-loader.js";

export function getCrossSellSuggestions(items = []) {
  const data = loadData();
  const suggestions = new Set();

  for (const item of items) {
    const text = norm(item.descricao || "");

    for (const [key, values] of Object.entries(data.crossSell || {})) {
      if (text.includes(norm(key))) {
        values.forEach((value) => suggestions.add(value));
      }
    }
  }

  return [...suggestions].slice(0, 6);
}
