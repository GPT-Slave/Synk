import fs from "node:fs";
import path from "node:path";

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(tsx|ts)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const files = walk("apps/web/src");
const usedKeys = new Set();
const keyRe = /\bt\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g;
for (const f of files) {
  if (f.endsWith("i18n.tsx")) continue;
  const content = fs.readFileSync(f, "utf8");
  let m;
  while ((m = keyRe.exec(content))) {
    usedKeys.add(m[2]);
  }
}

const i18nSrc = fs.readFileSync("apps/web/src/lib/i18n.tsx", "utf8");
const localeBlockRe = /^\s{2}(\w+):\s*\{$/;
const lines = i18nSrc.split("\n").map((l) => l.replace(/\r$/, ""));
let currentLocale = null;
let depth = 0;
const tables = {};
const entryRe = /^\s*(?:"((?:\\.|[^"])*)"|'((?:\\.|[^'])*)'|([A-Za-z_$][\w$]*))\s*:/;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const localeMatch = localeBlockRe.exec(line);
  if (localeMatch && currentLocale === null) {
    currentLocale = localeMatch[1];
    tables[currentLocale] = new Set();
    depth = 1;
    continue;
  }
  if (currentLocale) {
    if (/^\s{2}\},?$/.test(line)) {
      currentLocale = null;
      continue;
    }
    const em = entryRe.exec(line);
    if (em) {
      tables[currentLocale].add(em[1] ?? em[2] ?? em[3]);
    }
  }
}

let output = "";
const log = (...args) => {
  output += args.join(" ") + "\n";
};

log("Locales found:", Object.keys(tables).join(", "));
log("Used keys:", usedKeys.size);

for (const [locale, keys] of Object.entries(tables)) {
  const missing = [...usedKeys].filter((k) => !keys.has(k));
  log(`\n=== Missing in ${locale}: ${missing.length} ===`);
  for (const k of missing) log(" -", JSON.stringify(k));
}

fs.writeFileSync("i18n-audit-output.txt", output, "utf8");
console.log("done, wrote", output.length, "chars");

