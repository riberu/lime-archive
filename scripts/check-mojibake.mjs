import fs from "node:fs";
import path from "node:path";

const roots = ["src", "supabase", "scripts"];
const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".sql", ".css", ".md", ".json"]);
const suspiciousCharacter = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/u;
const allowedCharacters = new Set([
  "龍",
  "無"
]);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    if (extensions.has(path.extname(fullPath))) return [fullPath];
    return [];
  });
}

const findings = [];

for (const file of roots.flatMap(walk)) {
  const text = fs.readFileSync(file, "utf8");
  text.split(/\r?\n/).forEach((line, index) => {
    const hasSuspiciousText = [...line].some((character) => suspiciousCharacter.test(character) && !allowedCharacters.has(character));
    if (!hasSuspiciousText) return;
    findings.push(`${file}:${index + 1}: ${line.trim().slice(0, 180)}`);
  });
}

if (findings.length) {
  console.error("Possible mojibake found:\n" + findings.join("\n"));
  process.exit(1);
}

console.log("No mojibake-looking text found.");
