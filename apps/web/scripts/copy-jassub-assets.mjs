// Copies the JASSUB worker/wasm/font assets into apps/web/public/jassub so
// Next.js serves them as static files at /jassub/*. These are loaded by the
// <AssSubtitleOverlay> component, which renders ASS/SSA subtitles with full
// libass fidelity. Re-running is safe — existing files are overwritten.
//
// Inputs come from `jassub/dist/` (the npm package's build output). We only
// copy what the browser actually fetches:
//   - jassub-worker.js         (worker entry, loaded by the main thread)
//   - jassub-worker.wasm       (baseline libass build)
//   - jassub-worker-modern.wasm (SIMD-enabled build, optional fast path)
//   - default.woff2            (fallback font when an ASS file references
//                              a font we don't have)

import { mkdir, copyFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const pkgJsonPath = require.resolve("jassub/package.json");
const distDir = path.join(path.dirname(pkgJsonPath), "dist");

const outDir = path.join(__dirname, "..", "public", "jassub");

const files = [
  ["wasm/jassub-worker.js", "jassub-worker.js"],
  ["wasm/jassub-worker.wasm", "jassub-worker.wasm"],
  ["wasm/jassub-worker-modern.wasm", "jassub-worker-modern.wasm"],
  ["default.woff2", "default.woff2"],
];

await mkdir(outDir, { recursive: true });

for (const [rel, out] of files) {
  const src = path.join(distDir, rel);
  const dest = path.join(outDir, out);
  try {
    await copyFile(src, dest);
  } catch (err) {
    console.error(`[copy-jassub-assets] failed ${rel}:`, err.message);
    process.exit(1);
  }
}

console.log(`[copy-jassub-assets] copied ${files.length} files -> ${outDir}`);
