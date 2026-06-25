import { cors } from "../lib/utils.js";
import { loadProducts } from "../lib/products.js";

export default async function handler(req, res) {
  Object.entries(cors()).forEach(([key, value]) => res.setHeader(key, value));

  return res.status(200).json({
    ok: true,
    service: "eletro-lider-enterprise-v6",
    productsLoaded: loadProducts().length,
    time: new Date().toISOString()
  });
}
