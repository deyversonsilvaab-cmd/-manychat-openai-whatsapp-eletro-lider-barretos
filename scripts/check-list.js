import { loadProducts, searchProducts } from "../lib/product-search.js";
console.log(`Produtos carregados: ${loadProducts().length}`);
const query = process.argv.slice(2).join(" ") || "cabo 10mm";
console.log(`Busca: ${query}`);
console.log(searchProducts(query, 10));
