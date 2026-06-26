import { cors } from "../lib/utils.js";
import { loadProducts, searchProducts } from "../lib/products.js";
import { extractItems } from "../lib/items.js";

export default async function handler(req, res) {
  cors(res);

  const testMessage = "Oi, preciso de 10 metros de cabo 10mm e 2 disjuntores bipolar 40A";

  return res.status(200).json({
    ok: true,
    service: "eletro-lider-enterprise-v8-1-2-resposta-deterministica",
    productsLoaded: loadProducts().length,
    testExtraction: extractItems(testMessage),
    testSearch: {
      cabo10mm: searchProducts("cabo 10mm", 5),
      disjuntorBipolar40a: searchProducts("disjuntor bipolar 40a", 5)
    },
    expectedReplyBehavior: "Quando houver itens extraídos, o webhook responde de forma determinística e não deixa a IA dizer que não encontrou.",
    time: new Date().toISOString()
  });
}
