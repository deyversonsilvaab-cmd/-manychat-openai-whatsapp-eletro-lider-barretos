import fs from "fs";
import path from "path";

const input = process.argv[2] || "data/produtos.csv";
const output = process.argv[3] || "data/produtos.csv";

const inputPath = path.join(process.cwd(), input);
const outputPath = path.join(process.cwd(), output);

if (!fs.existsSync(inputPath)) {
  console.error(`Arquivo não encontrado: ${input}`);
  process.exit(1);
}

let content = fs.readFileSync(inputPath, "utf8").replace(/^\uFEFF/, "");
content = content
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .join("\n");

fs.writeFileSync(outputPath, content, "utf8");
console.log(`Lista normalizada em: ${output}`);
