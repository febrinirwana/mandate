import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const skipped = new Set([".git", ".next", "node_modules", "reference"]);
const skippedPaths = new Set([".agents", "contracts/lib"]);

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter((entry) => {
        const path = relative(root, join(directory, entry.name)).replaceAll("\\", "/");
        return !skipped.has(entry.name) && !skippedPaths.has(path);
      })
      .map(async (entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory()
          ? markdownFiles(path)
          : extname(entry.name) === ".md"
            ? [path]
            : [];
      }),
  );
  return nested.flat();
}

const failures = [];
for (const file of await markdownFiles(root)) {
  const text = await readFile(file, "utf8");
  const name = relative(root, file);
  const h1Count = text.match(/^# /gm)?.length ?? 0;
  const fenceCount = text.match(/^```/gm)?.length ?? 0;
  if (h1Count !== 1) failures.push(`${name}: expected exactly one H1, found ${h1Count}`);
  if (fenceCount % 2 !== 0) failures.push(`${name}: unbalanced fenced code blocks`);
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Documentation structure verified.");
}
