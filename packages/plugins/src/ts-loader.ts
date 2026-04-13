/**
 * TypeScript plugin loader — dynamically loads compiled JS plugins.
 *
 * TypeScript plugins are compiled to CommonJS at install time. The loader
 * validates the entry path is within the plugin directory (path traversal guard)
 * and duck-type validates the exported module against the OscuraPlugin interface.
 */

import path from "node:path";
import { existsSync } from "node:fs";
import type { OscuraPlugin, OscuraPluginManifest } from "./types";
import { PluginExecutionError } from "./executor";

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
