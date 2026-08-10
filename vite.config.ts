import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

const packageMetadata = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

export default defineConfig({
  plugins: [{
    name: "inject-app-version",
    transformIndexHtml(html) {
      return html.replaceAll("__APP_VERSION__", packageMetadata.version);
    },
  }],
});
