import { defineConfig } from "vitest/config";

// Load .cedar policy files as plain text, the same way the esbuild bundle does.
export default defineConfig({
  plugins: [
    {
      name: "cedar-as-text",
      transform(code, id) {
        if (id.endsWith(".cedar")) return { code: `export default ${JSON.stringify(code)};`, map: null };
      },
    },
  ],
});
