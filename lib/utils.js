export const clean = (v) => v == null ? "" : String(v).trim();

export function removeAccents(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function norm(value = "") {
  return removeAccents(value)
    .toUpperCase()
    .replace(/MM²|MM2|MM\^2/g, "MM")
    .replace(/(\d+)\s*,\s*(\d+)/g, "$1.$2")
    .replace(/(\d+)\s+MM/g, "$1MM")
    .replace(/(\d+)\s*A\b/g, "$1A")
    .replace(/\b2P\b/g, "2 X")
    .replace(/\b3P\b/g, "3 X")
    .replace(/[^A-Z0-9\s\.\/\-\*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokens(value = "") {
  return norm(value).split(" ").filter((t) => t.length >= 2);
}

export function safeJson(value, fallback = []) {
  try {
    if (!value) return fallback;
    if (Array.isArray(value) || typeof value === "object") return value;
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function truth(value) {
  return value === true || value === "true" || value === "1" || value === 1;
}

export function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}
