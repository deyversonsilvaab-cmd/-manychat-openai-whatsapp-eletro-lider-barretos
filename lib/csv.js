export function detectDelimiter(firstLine) {
  const semicolon = (firstLine.match(/;/g) || []).length;
  const comma = (firstLine.match(/,/g) || []).length;
  return semicolon >= comma ? ";" : ",";
}

export function parseCsvLine(line, delimiter) {
  const result = [];
  let current = "";
  let insideQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && next === '"') { current += '"'; i++; continue; }
    if (char === '"') { insideQuotes = !insideQuotes; continue; }
    if (char === delimiter && !insideQuotes) { result.push(current.trim()); current = ""; continue; }
    current += char;
  }
  result.push(current.trim());
  return result;
}
