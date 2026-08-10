import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const html = readFileSync("index.html", "utf8");
const robots = readFileSync("public/robots.txt", "utf8");
const sitemap = readFileSync("public/sitemap.xml", "utf8");
const llms = readFileSync("public/llms.txt", "utf8");
const packageMetadata = JSON.parse(readFileSync("package.json", "utf8"));
const siteUrl = "https://cwi.kisara.info/";

const count = (pattern) => [...html.matchAll(pattern)].length;
assert.equal(count(/<title>/gi), 1, "Exactly one title is required");
assert.equal(count(/<meta\s+name="description"/gi), 1, "Exactly one meta description is required");
assert.equal(count(/<link\s+rel="canonical"/gi), 1, "Exactly one canonical URL is required");
assert.match(html, new RegExp(`<link\\s+rel="canonical"\\s+href="${siteUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s*/?>`, "i"));
assert.doesNotMatch(html, /noindex/i);

for (const property of ["og:type", "og:title", "og:description", "og:url", "og:image", "og:image:width", "og:image:height"]) {
  assert.match(html, new RegExp(`<meta property="${property.replace(":", "\\:")}"`), `Missing ${property}`);
}
for (const name of ["twitter:card", "twitter:title", "twitter:description", "twitter:image"]) {
  assert.match(html, new RegExp(`<meta name="${name.replace(":", "\\:")}"`), `Missing ${name}`);
}

const jsonLdMatch = html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/);
assert.ok(jsonLdMatch, "Missing JSON-LD");
const jsonLd = JSON.parse(jsonLdMatch[1]);
assert.equal(jsonLd["@type"], "SoftwareApplication");
assert.equal(jsonLd.url, siteUrl);
assert.equal(jsonLd.softwareVersion, "__APP_VERSION__");
assert.match(html, /releases\/tag\/v__APP_VERSION__/);

assert.match(html, /<details class="project-info">/);
assert.match(html, /数百项遥测字段/);
assert.match(robots, /Allow:\s*\/(?:\s|$)/i);
assert.match(robots, /Sitemap:\s*https:\/\/cwi\.kisara\.info\/sitemap\.xml(?:\s|$)/i);
assert.match(sitemap, /<loc>\s*https:\/\/cwi\.kisara\.info\/\s*<\/loc>/i);
assert.match(sitemap, /<lastmod>\s*\d{4}-\d{2}-\d{2}\s*<\/lastmod>/i);
assert.match(llms, /Live demo: https:\/\/cwi\.kisara\.info\//);
assert.match(llms, /github\.com\/Sekai6\/game-coldwar-intercept/);
assert.ok(existsSync("public/og-cover.png"), "Missing Open Graph image");
assert.ok(existsSync("public/favicon.svg"), "Missing favicon");

console.log(JSON.stringify({ title: true, metadata: true, structuredData: true, crawlFiles: true, visibleProjectInfo: true }));
