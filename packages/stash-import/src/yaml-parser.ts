import { readFile } from "node:fs/promises";
import yaml from "js-yaml";
import {
  type ScraperYamlDef,
  type ScraperCapabilities,
  type ScraperActionDef,
  type ScraperScriptDef,
  type ScraperXPathDef,
  capabilityKeys,
} from "./types";

export class ScraperParseError extends Error {
  constructor(
    message: string,
    public readonly yamlPath: string
  ) {
    super(`${message} (${yamlPath})`);
    this.name = "ScraperParseError";
  }
}

/**
 * Parse a scraper YAML definition file and extract capabilities.
 */
export async function parseScraperYaml(yamlPath: string): Promise<{
  definition: ScraperYamlDef;
  capabilities: ScraperCapabilities;
}> {
  const content = await readFile(yamlPath, "utf8");
  const raw = yaml.load(content);

  if (!raw || typeof raw !== "object") {
    throw new ScraperParseError("Invalid YAML: expected an object", yamlPath);
  }

  const def = raw as Record<string, unknown>;
  if (typeof def.name !== "string" || !def.name) {
    throw new ScraperParseError("Missing required field: name", yamlPath);
  }

  const capabilities: ScraperCapabilities = {
    sceneByURL: false,
    sceneByFragment: false,
    sceneByName: false,
    sceneByQueryFragment: false,
    performerByURL: false,
    performerByFragment: false,
    performerByName: false,
    galleryByURL: false,
    galleryByFragment: false,
    groupByURL: false,
  };

  for (const key of capabilityKeys) {
    capabilities[key] = key in def && def[key] != null;
  }

  return {
    definition: raw as ScraperYamlDef,
    capabilities,
  };
}

/**
 * Resolve the action definition for a given action from a scraper definition.
 * Handles both single definitions and arrays of URL-matched definitions.
 */
export function resolveActionDef(
  definition: ScraperYamlDef,
  action: string,
  inputUrl?: string
): ScraperActionDef | null {
  const entry = definition[action as keyof ScraperYamlDef];
  if (!entry || typeof entry !== "object") return null;

  // Single definition object
  if (!Array.isArray(entry)) {
    const def = entry as ScraperActionDef;
    if (!def.action) return null;
    return def;
  }

  // Array of URL-matched definitions
  const defs = entry as ScraperActionDef[];

  if (inputUrl) {
    for (const def of defs) {
      if (!def.action) continue;
      if (!def.url || def.url.length === 0) return def;
      if (def.url.some((pattern) => inputUrl.includes(pattern))) return def;
    }
  }

  // Fallback to first valid action
  return defs.find((d) => !!d.action) ?? null;
}

/**
 * @deprecated Use resolveActionDef instead
 */
export function resolveScriptDef(
  definition: ScraperYamlDef,
  action: string,
  inputUrl?: string
): ScraperScriptDef | null {
  const def = resolveActionDef(definition, action, inputUrl);
  if (!def || def.action !== "script") return null;
  return def;
}
