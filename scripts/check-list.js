import { loadProducts, searchProducts } from "../lib/products.js";

console.log(`Produtos carregados: ${loadProducts().length}`);
console.log(searchProducts(process.argv.slice(2).join(" ") || "cabo 10mm", 10));
