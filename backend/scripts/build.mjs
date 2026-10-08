// Bundles each Lambda handler into dist/<name>/index.mjs for `sam deploy`.
import { build } from "esbuild";
import { rmSync } from "node:fs";

const handlers = {
  ingest: "src/ingest/handler.ts",
};

rmSync("dist", { recursive: true, force: true });

await Promise.all(
  Object.entries(handlers).map(([name, entry]) =>
    build({
      entryPoints: [entry],
      outfile: `dist/${name}/index.mjs`,
      bundle: true,
      platform: "node",
      target: "node22",
      format: "esm",
      sourcemap: true,
      // The nodejs22.x runtime ships AWS SDK v3.
      external: ["@aws-sdk/*"],
      // Some bundled dependencies are CommonJS and call require().
      banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
      logLevel: "warning",
    }),
  ),
);
console.log(`built ${Object.keys(handlers).join(", ")}`);
