import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const skippedDirectories = new Set([
  ".git",
  ".next",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "reference",
]);
const skippedPaths = new Set([".agents", "contracts/lib"]);
const textExtensions = new Set([
  "",
  ".cjs",
  ".env",
  ".example",
  ".json",
  ".js",
  ".md",
  ".mjs",
  ".sol",
  ".toml",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);
const rules = [
  ["private key", /\b(?:private[_-]?key|secret[_-]?key)\s*[:=]\s*["']?0x[0-9a-fA-F]{64}\b/i],
  ["mnemonic", /\b(?:mnemonic|seed phrase)\s*[:=]\s*["']?[a-z]+(?:\s+[a-z]+){11,23}/i],
  [
    "credential",
    /\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*["']?(?!replace_me|mandate\b|process\.env|\$\{)[A-Za-z0-9_+./=-]{16,}/i,
  ],
];

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter((entry) => {
        const path = relative(root, join(directory, entry.name)).replaceAll("\\", "/");
        return !skippedDirectories.has(entry.name) && !skippedPaths.has(path);
      })
      .map(async (entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) return files(path);
        return textExtensions.has(extname(entry.name)) ? [path] : [];
      }),
  );
  return nested.flat();
}

const findings = [];
for (const file of await files(root)) {
  const name = relative(root, file);
  const text = await readFile(file, "utf8");
  for (const [label, pattern] of rules) {
    if (pattern.test(text)) findings.push(`${name}: possible ${label}`);
  }
}

if (findings.length > 0) {
  console.error(findings.join("\n"));
  process.exitCode = 1;
} else {
  console.log("No likely committed secrets found.");
}
