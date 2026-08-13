import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const libRoot = path.join(root, "apps", "web", "src", "lib");
const catalogFile = path.join(libRoot, "i18n", "index.tsx");
const legacyAuditPath = path.join(libRoot, "i18n.tsx");
let compatibilityCopyCreated = false;

try {
  if (!fs.existsSync(legacyAuditPath) && fs.existsSync(catalogFile)) {
    fs.copyFileSync(catalogFile, legacyAuditPath);
    compatibilityCopyCreated = true;
  }
  await import("./i18n-audit-core.mjs");
} finally {
  if (compatibilityCopyCreated) {
    fs.rmSync(legacyAuditPath, { force: true });
  }
}
