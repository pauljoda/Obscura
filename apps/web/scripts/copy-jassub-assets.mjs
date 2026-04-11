// Prepares JASSUB runtime assets under apps/web/public/jassub so Next.js
// serves them as static files at /jassub/*. The <AssSubtitleOverlay>
// component hands the worker URL + wasm URL to JASSUB; the component and
// JASSUB itself are dynamically imported, so nothing here needs to be in
// the web app bundle.
//
// What ends up in public/jassub:
//   - jassub-worker.js   — bundled Web Worker entry (built from
//                          jassub/dist/worker/worker.js with esbuild).
//                          The published `worker.js` is an ESM module with
//                          bare-specifier imports (`abslink`, `lfa-ponyfill`,
//                          relative wasm loader), so it CANNOT be served as
//                          a static file — the browser can't resolve bare
//                          specifiers in a Worker context. We bundle it into
//                          a self-contained IIFE here.
//   - jassub-worker.wasm         — baseline libass build
//   - jassub-worker-modern.wasm  — SIMD-enabled build (JASSUB picks this
//                                  when the browser supports SIMD)
//   - default.woff2              — fallback font

import { mkdir, copyFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const pkgJsonPath = require.resolve("jassub/package.json");
const distDir = path.join(path.dirname(pkgJsonPath), "dist");

const outDir = path.join(__dirname, "..", "public", "jassub");
await mkdir(outDir, { recursive: true });

// Bundle the worker entry into a self-contained IIFE script the browser can
// load as a classic Worker (`type: "classic"` on the JASSUB side). We mark
// the two sibling wasm files external — the `../wasm/jassub-worker.js`
// import in the source is the Emscripten JS wrapper, which we inline — but
// the actual .wasm binaries are loaded by URL at runtime and don't need to
// be in the bundle.
await esbuild.build({
  entryPoints: [path.join(distDir, "worker", "worker.js")],
  outfile: path.join(outDir, "jassub-worker.js"),
  bundle: true,
  // JASSUB instantiates the Worker with `type: "module"`, so we emit an
  // ESM bundle. Bare specifiers (`abslink`, `lfa-ponyfill`, the wasm
  // loader) get inlined; `import.meta.url` references are preserved and
  // resolve against the worker's own URL (/jassub/jassub-worker.js),
  // though we override wasm loading anyway via the wasmUrl option passed
  // to JASSUB at construction.
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  sourcemap: false,
  // JASSUB is an ES module with `import.meta.url` references for loading the
  // sibling .wasm file. We override those via the `wasmUrl` option we pass
  // to JASSUB in <AssSubtitleOverlay>, so the bundler only needs to resolve
  // JS/TS imports.
  loader: { ".wasm": "empty" },
});

// Copy the raw wasm + font assets next to the bundled worker.
const staticFiles = [
  ["wasm/jassub-worker.wasm", "jassub-worker.wasm"],
  ["wasm/jassub-worker-modern.wasm", "jassub-worker-modern.wasm"],
  ["default.woff2", "default.woff2"],
];

for (const [rel, out] of staticFiles) {
  const src = path.join(distDir, rel);
  const dest = path.join(outDir, out);
  try {
    await copyFile(src, dest);
  } catch (err) {
    console.error(`[copy-jassub-assets] failed ${rel}:`, err.message);
    process.exit(1);
  }
}

console.log(
  `[copy-jassub-assets] bundled worker + copied ${staticFiles.length} static files -> ${outDir}`,
);
