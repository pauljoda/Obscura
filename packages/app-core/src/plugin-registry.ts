import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import { schema, type AppDb } from "@obscura/db";
import {
  clearPluginIndexCache,
  fetchPluginIndex,
  resolveEntryZipUrl,
  type PluginIndexEntry,
} from "@obscura/plugins";
import { InternalError, NotFoundError, UpstreamError } from "./errors";

const { pluginPackages, scraperPackages } = schema;

export interface PluginRegistryQuery {
  source?: string;
  isNsfw?: string;
}

export interface PluginRefreshQuery {
  refresh?: string;
}

function comparePluginSemver(a: string, b: string): number {
  const parse = (value: string) =>
    value
      .split(/[-+]/)[0]
      .split(".")
      .map((part) => Number.parseInt(part, 10) || 0);

  const left = parse(a);
  const right = parse(b);
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff !== 0) return diff;
  }

  return 0;
}

async function getInstalledPluginVersionMap(db: AppDb) {
  const installed = await db
    .select({ pluginId: pluginPackages.pluginId, version: pluginPackages.version })
    .from(pluginPackages);

  return new Map(installed.map((entry) => [entry.pluginId, entry.version]));
}

export async function getUnifiedPluginIndexRead(
  db: AppDb,
  query: PluginRegistryQuery,
) {
  const filterNsfw = query.isNsfw === "false" ? false : undefined;

  const installed = await db.select().from(pluginPackages).orderBy(pluginPackages.name);
  const stashScrapers = await db
    .select()
    .from(scraperPackages)
    .orderBy(scraperPackages.name);

  const unified = [
    ...installed.map((plugin) => ({
      id: plugin.id,
      pluginId: plugin.pluginId,
      name: plugin.name,
      version: plugin.version,
      runtime: plugin.runtime,
      isNsfw: plugin.isNsfw,
      enabled: plugin.enabled,
      capabilities: plugin.capabilities ?? {},
      pluginType: "obscura-native" as const,
      sourceIndex: plugin.sourceIndex,
    })),
    ...stashScrapers.map((scraper) => ({
      id: scraper.id,
      pluginId: scraper.packageId,
      name: scraper.name,
      version: scraper.version,
      runtime: "stash-compat" as const,
      isNsfw: scraper.isNsfw,
      enabled: scraper.enabled,
      capabilities: scraper.capabilities ?? {},
      pluginType: "stash-compat" as const,
      sourceIndex: "stash-community",
    })),
  ];

  if (filterNsfw === false) {
    return unified.filter((entry) => !entry.isNsfw);
  }

  return unified;
}

function resolveLocalPluginIndexPath(): string | undefined {
  let localPath = process.env.OBSCURA_PLUGIN_INDEX_PATH;
  const remoteUrl =
    process.env.OBSCURA_PLUGIN_INDEX_URL ??
    (process.env.NODE_ENV === "production"
      ? "https://raw.githubusercontent.com/pauljoda/obscura-community-plugins/main"
      : undefined);

  if (localPath || remoteUrl || process.env.NODE_ENV === "production") {
    return localPath;
  }

  let dir = process.cwd();
  for (let depth = 0; depth < 5; depth += 1) {
    const parent = path.dirname(dir);
    const candidate = path.join(parent, "obscura-community-plugins");
    if (existsSync(path.join(candidate, "index.yml"))) {
      localPath = candidate;
      break;
    }
    if (parent === dir) break;
    dir = parent;
  }

  return localPath;
}

function resolveRemotePluginIndexUrl(): string | undefined {
  return (
    process.env.OBSCURA_PLUGIN_INDEX_URL ??
    (process.env.NODE_ENV === "production"
      ? "https://raw.githubusercontent.com/pauljoda/obscura-community-plugins/main"
      : undefined)
  );
}

function resolveRefreshFlag(query: PluginRefreshQuery): boolean {
  return query.refresh === "1" || query.refresh === "true";
}

export async function getObscuraPluginIndexRead(
  db: AppDb,
  query: PluginRefreshQuery,
) {
  const forceRefresh = resolveRefreshFlag(query);
  const localPath = resolveLocalPluginIndexPath();
  const remoteUrl = resolveRemotePluginIndexUrl();

  if (localPath) {
    const indexPath = path.join(localPath, "index.yml");
    if (!existsSync(indexPath)) {
      throw new NotFoundError(`Plugin index not found at ${indexPath}`);
    }

    try {
      const raw = await readFile(indexPath, "utf-8");
      const entries = yaml.load(raw, { schema: yaml.JSON_SCHEMA });
      if (!Array.isArray(entries)) {
        throw new InternalError("Invalid plugin index format");
      }

      const installedMap = await getInstalledPluginVersionMap(db);
      return entries.map((entry: Record<string, unknown>) => {
        const pluginId = String(entry.id);
        const installedVersion = installedMap.get(pluginId) ?? null;
        return {
          ...entry,
          installed: installedMap.has(pluginId),
          installedVersion,
          updateAvailable:
            installedVersion !== null &&
            comparePluginSemver(String(entry.version ?? "0.0.0"), installedVersion) > 0,
          localPath: path.join(localPath, "plugins", pluginId),
        };
      });
    } catch (error) {
      if (error instanceof InternalError) throw error;
      throw new InternalError(
        `Failed to read plugin index: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (remoteUrl) {
    try {
      if (forceRefresh) clearPluginIndexCache();
      const entries = await fetchPluginIndex(remoteUrl, forceRefresh);
      const installedMap = await getInstalledPluginVersionMap(db);

      return entries.map((entry) => ({
        ...entry,
        path: resolveEntryZipUrl(remoteUrl, entry.path),
        installed: installedMap.has(entry.id),
        installedVersion: installedMap.get(entry.id) ?? null,
        updateAvailable:
          installedMap.has(entry.id) &&
          comparePluginSemver(entry.version, installedMap.get(entry.id) ?? "0.0.0") > 0,
      }));
    } catch (error) {
      throw new UpstreamError(
        `Failed to fetch remote plugin index: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  throw new NotFoundError(
    "No plugin index configured. Set OBSCURA_PLUGIN_INDEX_PATH (dev) or OBSCURA_PLUGIN_INDEX_URL (production).",
  );
}

export async function getPluginUpdateStatusesRead(
  db: AppDb,
  query: PluginRefreshQuery,
) {
  const forceRefresh = resolveRefreshFlag(query);
  const remoteUrl =
    process.env.OBSCURA_PLUGIN_INDEX_URL ??
    "https://raw.githubusercontent.com/pauljoda/obscura-community-plugins/main";

  const installedPlugins = await db
    .select({ pluginId: pluginPackages.pluginId, version: pluginPackages.version })
    .from(pluginPackages);

  let entries: PluginIndexEntry[];
  try {
    if (forceRefresh) clearPluginIndexCache();
    entries = await fetchPluginIndex(remoteUrl, forceRefresh);
  } catch (error) {
    throw new UpstreamError(
      `Failed to fetch remote plugin index: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const byId = new Map(entries.map((entry) => [entry.id, entry]));

  return installedPlugins.map((plugin) => {
    const remote = byId.get(plugin.pluginId);
    const availableVersion = remote?.version ?? null;
    return {
      pluginId: plugin.pluginId,
      installedVersion: plugin.version,
      availableVersion,
      updateAvailable:
        !!availableVersion &&
        comparePluginSemver(availableVersion, plugin.version) > 0,
      zipUrl: remote ? resolveEntryZipUrl(remoteUrl, remote.path) : null,
      sha256: remote?.sha256 ?? null,
    };
  });
}
