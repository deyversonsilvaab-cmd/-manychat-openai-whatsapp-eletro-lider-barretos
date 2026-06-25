export function cleanText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function removeAccents(text) {
  return String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeText(text) {
  return removeAccents(text)
    .toLowerCase()
    .replace(/[^\w\s\/\-\.\,\(\)"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function safeJsonParse(value, fallback = null) {
  try {
    if (!value) return fallback;
    if (Array.isArray(value) || typeof value === "object") return value;
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}
