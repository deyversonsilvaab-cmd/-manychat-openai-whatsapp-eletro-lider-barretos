import { loadMemory } from "../lib/memory.js";

const key = process.argv[2] || "teste";
console.log(loadMemory(key) || "Sem memória para este contato.");
