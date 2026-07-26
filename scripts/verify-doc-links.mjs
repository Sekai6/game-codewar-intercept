import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { readdirSync } from "node:fs";

const documents = [
  "README.md",
  "README_EN.md",
  "ARCHITECTURE.md",
  "docs/WEBGPU_RENDERER_MIGRATION.md",
  "docs/WEBGPU_ULTRA.md",
  "docs/zh/SIMULATION.md",
  "docs/zh/ARCHITECTURE.md",
  "docs/zh/OPERATIONS.md",
  "docs/zh/VERIFICATION.md",
];

function collectMarkdown(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectMarkdown(path);
    return entry.isFile() && entry.name.endsWith(".md") ? [path] : [];
  }).map((path) => path.replace(`${resolve(".")}${process.platform === "win32" ? "\\" : "/"}`, "").replaceAll("\\", "/"));
}

documents.push(...collectMarkdown("wiki"));

const failures = [];
let checked = 0;
for (const document of documents) {
  assert.ok(existsSync(document), `Missing documentation entry: ${document}`);
  const markdown = readFileSync(document, "utf8");
  for (const match of markdown.matchAll(/!?(?:\[[^\]]*\])\(([^)]+)\)/g)) {
    const destination = match[1].trim().replace(/^<|>$/g, "").split("#", 1)[0];
    if (!destination || /^(?:https?:|mailto:)/i.test(destination)) continue;
    checked++;
    const target = resolve(dirname(document), decodeURIComponent(destination));
    if (!existsSync(target)) failures.push(`${document} -> ${destination}`);
  }
}

assert.deepEqual(failures, [], `Broken local documentation links:\n${failures.join("\n")}`);
console.log(JSON.stringify({ documents: documents.length, localLinksChecked: checked }));
