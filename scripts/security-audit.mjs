import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean);
const failures = [];

for (const file of tracked) {
  if (/(^|\/)\.env(?:\.|$)/.test(file) && !file.endsWith(".env.example")) {
    failures.push(`${file}: environment file is tracked`);
  }
  if (/\.(?:pem|key|p12|pfx)$/i.test(file)) {
    failures.push(`${file}: private key or certificate is tracked`);
  }
}

auditSource(
  tracked.filter(
    (file) => file.startsWith("apps/web/src/") && /\.[cm]?[jt]sx?$/.test(file),
  ),
  [
    [
      /dangerouslySetInnerHTML|\.innerHTML\s*=|\beval\s*\(|new\s+Function\s*\(/,
      "unsafe HTML or code execution sink",
    ],
    [
      /NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|API_KEY)/,
      "secret-like NEXT_PUBLIC variable",
    ],
    [
      /process\.env\.(?!NEXT_PUBLIC_API_URL\b|NEXT_PUBLIC_WS_URL\b|NODE_ENV\b)[A-Z0-9_]+/,
      "private environment variable referenced by web source",
    ],
  ],
);

auditSource(
  tracked.filter(
    (file) => file.startsWith("apps/api/src/") && /\.[cm]?[jt]s$/.test(file),
  ),
  [
    [
      /\$queryRaw(?:Unsafe)?|\$executeRaw(?:Unsafe)?/,
      "raw SQL bypasses the Prisma query API",
    ],
  ],
);

if (failures.length > 0) {
  console.error(
    "Security audit failed:\n" + failures.map((item) => `- ${item}`).join("\n"),
  );
  process.exit(1);
}

console.log(
  "Security audit passed: env files, client secrets, XSS sinks, and raw SQL checked.",
);

function auditSource(files, checks) {
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const [pattern, description] of checks) {
      if (pattern.test(source)) failures.push(`${file}: ${description}`);
    }
  }
}
