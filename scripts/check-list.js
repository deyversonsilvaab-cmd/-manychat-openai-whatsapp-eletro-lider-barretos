import { loadProducts, searchProducts } from "../lib/product-search.js";

const products = loadProducts();
console.log(`Produtos carregados: ${products.length}`);

const query = process.argv.slice(2).join(" ") || "cabo";
console.log(`Busca: ${query}`);
console.log(searchProducts(query, 10));
