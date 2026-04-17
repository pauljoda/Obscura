/**
 * TypeScript plugin loader — dynamically loads compiled JS plugins.
 *
 * TypeScript plugins are compiled to CommonJS at install time. The loader
 * validates the entry path is within the plugin directory (path traversal guard)
 * and duck-type validates the exported module against the OscuraPlugin interface.
 */

import path from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { OscuraPlugin, OscuraPluginManifest } from "./types";
import { PluginExecutionError } from "./executor";

/**
 * Plugins ship compiled JS. Most today are bundled as CommonJS (the
 * entry file contains `exports.default = {...}`). Node resolves the
 * module format by walking up for the nearest `package.json`, which
 * for plugins installed under `apps/worker/.obscura-cache/plugins/*`
 * lands on `apps/worker/package.json` — and that file declares
 * `"type": "module"`, so the loader tries to parse CJS code as ESM
 * and fails with "exports is not defined in ES module scope".
 *
 * Drop a sentinel `package.json` alongside the entry file declaring
 * `"type": "commonjs"` the first time a plugin is loaded. Node stops
 * walking at this closer package.json and treats the sibling `.js`
 * file as CommonJS. Safe for plugins that are genuinely ESM because
 * we only write the sentinel when the entry contains CJS markers.
 */
function ensureCjsSentinel(entryPath: string): void {
  try {
    const contents = readFileSync(entryPath, "utf8");
    const looksLikeCjs =
      /\bexports\.[a-zA-Z_$]/.test(contents) ||
      /\bmodule\.exports\b/.test(contents) ||
      /"use strict";/.test(contents);
    if (!looksLikeCjs) return;
    const sentinelPath = path.join(path.dirname(entryPath), "package.json");
    if (existsSync(sentinelPath)) return;
    writeFileSync(
      sentinelPath,
      JSON.stringify({ type: "commonjs" }, null, 2) + "\n",
      "utf8",
    );
  } catch {
    // Best-effort — if we can't write the sentinel, fall through and
    // let the import() below throw a meaningful error.
  }
}

/**
 * Load a TypeScript plugin's compiled JS entry point and return it
 * as an OscuraPlugin interface.
 */
export async function loadTypeScriptPlugin(
  manifest: OscuraPluginManifest,
  installDir: string,
): Promise<OscuraPlugin> {
  if (!manifest.entry) {
    throw new PluginExecutionError(
      `Plugin "${manifest.id}" has no entry point defined`,
      manifest.id,
      "load",
    );
  }

  const entryPath = path.resolve(installDir, manifest.entry);

  // Path traversal guard
  if (!entryPath.startsWith(path.resolve(installDir))) {
    throw new PluginExecutionError(
      `Plugin entry path escapes install directory: ${manifest.entry}`,
      manifest.id,
      "load",
    );
  }

  if (!existsSync(entryPath)) {
    throw new PluginExecutionError(
      `Plugin entry file not found: ${entryPath}`,
      manifest.id,
      "load",
    );
  }

  // Ensure CJS bundles load correctly regardless of the nearest
  // package.json's "type" setting in the hosting app.
  ensureCjsSentinel(entryPath);

  // Dynamic import — works for both ESM and CJS (Node resolves)
  let mod: Record<string, unknown>;
  try {
    mod = await import(entryPath);
  } catch (err) {
    throw new PluginExecutionError(
      `Failed to load plugin: ${err instanceof Error ? err.message : String(err)}`,
      manifest.id,
      "load",
    );
  }

  // The module should export a default that conforms to OscuraPlugin
  const plugin = (mod.default ?? mod) as Record<string, unknown>;

  // Duck-type validation
  if (typeof plugin.execute !== "function") {
    throw new PluginExecutionError(
      `Plugin "${manifest.id}" does not export an execute() function`,
      manifest.id,
      "load",
    );
  }

  if (!plugin.capabilities || typeof plugin.capabilities !== "object") {
    throw new PluginExecutionError(
      `Plugin "${manifest.id}" does not export a capabilities object`,
      manifest.id,
      "load",
    );
  }

  return plugin as unknown as OscuraPlugin;
}
