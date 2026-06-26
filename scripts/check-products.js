import { loadProducts, searchProducts } from "../lib/products.js";
import { extractItems } from "../lib/items.js";

const msg = process.argv.slice(2).join(" ") || "Oi, preciso de 10 metros de cabo 10mm e 2 disjuntores bipolar 40A";

console.log("Produtos carregados:", loadProducts().length);
console.log("Mensagem:", msg);
console.log("Extração:", extractItems(msg));
console.log("Busca cabo:", searchProducts("cabo 10mm", 5));
console.log("Busca disj:", searchProducts("disjuntor bipolar 40a", 5));
