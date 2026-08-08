import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = path.join(root, "apps", "web");
const webRequire = createRequire(path.join(webRoot, "package.json"));
const ts = webRequire("typescript");

const UI_STRING_PROPS = new Set([
  "aria-label",
  "aria-description",
  "placeholder",
  "title",
  "alt",
]);
const RAW_TEXT_ALLOWLIST = new Set(["Synk", "TZ", "you@example.com"]);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(tsx|ts)$/.test(entry.name)) files.push(full);
  }
  return files;
}

function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function hasWords(value) {
  return /\p{L}/u.test(value);
}

function propertyNameText(name) {
  if (!name) return undefined;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return undefined;
}

function unwrapExpression(node) {
  let current = node;
  while (
    current &&
    (ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isTypeAssertionExpression(current) ||
      (ts.isSatisfiesExpression && ts.isSatisfiesExpression(current)))
  ) {
    current = current.expression;
  }
  return current;
}

function literalText(node) {
  const value = unwrapExpression(node);
  if (!value) return undefined;
  if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) {
    return value.text;
  }
  return undefined;
}

function isTranslationCall(node) {
  const value = unwrapExpression(node);
  return (
    value &&
    ts.isCallExpression(value) &&
    ts.isIdentifier(value.expression) &&
    value.expression.text === "t"
  );
}

function renderedLiteralCandidates(expression) {
  const value = unwrapExpression(expression);
  if (!value || isTranslationCall(value)) return [];
  const direct = literalText(value);
  if (direct !== undefined) return [direct];
  if (ts.isConditionalExpression(value)) {
    return [
      ...renderedLiteralCandidates(value.whenTrue),
      ...renderedLiteralCandidates(value.whenFalse),
    ];
  }
  if (ts.isBinaryExpression(value)) {
    const op = value.operatorToken.kind;
    if (
      op === ts.SyntaxKind.AmpersandAmpersandToken ||
      op === ts.SyntaxKind.BarBarToken ||
      op === ts.SyntaxKind.QuestionQuestionToken
    ) {
      return renderedLiteralCandidates(value.right);
    }
  }
  return [];
}

function lineAndColumn(sourceFile, node) {
  const point = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return `${point.line + 1}:${point.character + 1}`;
}

function addRawIssue(issues, file, sourceFile, node, text, context) {
  const normalized = normalizeText(text);
  if (!normalized || !hasWords(normalized) || RAW_TEXT_ALLOWLIST.has(normalized)) return;
  issues.push({
    file: path.relative(root, file).replaceAll(path.sep, "/"),
    location: lineAndColumn(sourceFile, node),
    text: normalized,
    context,
  });
}

function isLocalizationImplementation(file) {
  return path.basename(file).startsWith("i18n");
}

function scanSource(file, usedKeys, rawIssues) {
  const source = fs.readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "t" &&
      node.arguments.length > 0
    ) {
      const key = literalText(node.arguments[0]);
      if (key !== undefined) usedKeys.add(key);
    }

    if (!isLocalizationImplementation(file)) {
      if (ts.isJsxText(node)) {
        addRawIssue(rawIssues, file, sourceFile, node, node.getText(sourceFile), "JSX text");
      }

      if (
        ts.isJsxExpression(node) &&
        node.expression &&
        !ts.isJsxAttribute(node.parent)
      ) {
        for (const text of renderedLiteralCandidates(node.expression)) {
          addRawIssue(rawIssues, file, sourceFile, node, text, "rendered JSX expression");
        }
      }

      if (ts.isJsxAttribute(node)) {
        const name = node.name.getText(sourceFile);
        if (UI_STRING_PROPS.has(name) && node.initializer) {
          if (ts.isStringLiteral(node.initializer)) {
            addRawIssue(
              rawIssues,
              file,
              sourceFile,
              node,
              node.initializer.text,
              `JSX ${name}`,
            );
          } else if (
            ts.isJsxExpression(node.initializer) &&
            node.initializer.expression &&
            !isTranslationCall(node.initializer.expression)
          ) {
            for (const text of renderedLiteralCandidates(node.initializer.expression)) {
              addRawIssue(rawIssues, file, sourceFile, node, text, `JSX ${name}`);
            }
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

function sourceFileFor(file) {
  const source = fs.readFileSync(file, "utf8");
  return ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function findVariableObject(sourceFile, variableName) {
  let found;
  function visit(node) {
    if (found) return;
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === variableName) {
      const initializer = unwrapExpression(node.initializer);
      if (initializer && ts.isObjectLiteralExpression(initializer)) found = initializer;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return found;
}

function extractLocaleTables(file, variableName) {
  if (!fs.existsSync(file)) return {};
  const object = findVariableObject(sourceFileFor(file), variableName);
  if (!object) return {};

  const result = {};
  for (const localeProperty of object.properties) {
    if (!ts.isPropertyAssignment(localeProperty)) continue;
    const locale = propertyNameText(localeProperty.name);
    const table = unwrapExpression(localeProperty.initializer);
    if (!locale || !table || !ts.isObjectLiteralExpression(table)) continue;
    result[locale] = new Set();
    for (const entry of table.properties) {
      if (!ts.isPropertyAssignment(entry)) continue;
      const key = propertyNameText(entry.name);
      if (key !== undefined) result[locale].add(key);
    }
  }
  return result;
}

function extractFlatTable(file, variableName) {
  if (!fs.existsSync(file)) return new Set();
  const object = findVariableObject(sourceFileFor(file), variableName);
  const keys = new Set();
  if (!object) return keys;
  for (const entry of object.properties) {
    if (!ts.isPropertyAssignment(entry)) continue;
    const key = propertyNameText(entry.name);
    if (key !== undefined) keys.add(key);
  }
  return keys;
}

function extractSupportedLocales(file) {
  const sourceFile = sourceFileFor(file);
  let locales = [];
  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "supportedLocales" &&
      node.initializer
    ) {
      const initializer = unwrapExpression(node.initializer);
      if (initializer && ts.isArrayLiteralExpression(initializer)) {
        locales = initializer.elements
          .map((element) => literalText(element))
          .filter((value) => value !== undefined);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return locales;
}

function mergeTables(...tables) {
  const merged = {};
  for (const table of tables) {
    for (const [locale, keys] of Object.entries(table)) {
      merged[locale] ??= new Set();
      for (const key of keys) merged[locale].add(key);
    }
  }
  return merged;
}

const files = walk(path.join(webRoot, "src"));
const usedKeys = new Set();
const rawIssues = [];
for (const file of files) scanSource(file, usedKeys, rawIssues);

const libRoot = path.join(webRoot, "src", "lib");
const legacyFile = path.join(libRoot, "i18n.tsx");
const runtimeFile = path.join(libRoot, "i18n-runtime.tsx");
const extraFile = path.join(libRoot, "i18n-extra.ts");
const uiFile = path.join(libRoot, "i18n-ui.ts");
const supportedLocales = [...extractSupportedLocales(legacyFile), "it"];
const tables = mergeTables(
  extractLocaleTables(legacyFile, "translations"),
  extractLocaleTables(runtimeFile, "supplementalTranslations"),
  extractLocaleTables(extraFile, "extraTranslations"),
  extractLocaleTables(uiFile, "uiTranslations"),
);
tables.it ??= new Set();
for (const key of extractFlatTable(runtimeFile, "italianTranslations")) {
  tables.it.add(key);
}

const missingByLocale = {};
for (const locale of supportedLocales) {
  if (locale === "en") continue;
  const keys = tables[locale] ?? new Set();
  missingByLocale[locale] = [...usedKeys].filter((key) => !keys.has(key)).sort();
}

console.log(`i18n audit: ${files.length} source files, ${usedKeys.size} translated UI keys`);
console.log(`Supported locales: ${supportedLocales.join(", ")}`);

console.log(`\nRaw user-facing literals: ${rawIssues.length}`);
for (const issue of rawIssues) {
  console.log(` - ${issue.file}:${issue.location} [${issue.context}] ${JSON.stringify(issue.text)}`);
}

let missingTotal = 0;
for (const [locale, missing] of Object.entries(missingByLocale)) {
  missingTotal += missing.length;
  console.log(`\nMissing in ${locale}: ${missing.length}`);
  for (const key of missing) console.log(` - ${JSON.stringify(key)}`);
}

const output = {
  usedKeyCount: usedKeys.size,
  supportedLocales,
  rawIssues,
  missingByLocale,
};
fs.writeFileSync(path.join(root, "i18n-audit-output.json"), `${JSON.stringify(output, null, 2)}\n`, "utf8");

if (rawIssues.length || missingTotal) {
  console.error(`\ni18n audit failed: ${rawIssues.length} raw literals and ${missingTotal} missing translations.`);
  process.exitCode = 1;
} else {
  console.log("\ni18n audit passed: no raw user-facing literals or missing translations.");
}
