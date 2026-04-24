import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { unzipSync } from "fflate";
import { and, eq } from "drizzle-orm";
import { schema, type AppDb } from "@obscura/db";
import { getCacheRootDir } from "@obscura/media-core";
import { encryptAuthValue, readManifest } from "@obscura/plugins";
import { NotFoundError, UpstreamError, ValidationError } from "./errors";

const { pluginAuth, pluginPackages } = schema;

export interface InstallPluginPackageInput {
  pluginId: string;
  zipUrl?: string;
  localPath?: string;
  sha256?: string;
}

export interface SetPluginAuthValueInput {
  pluginDbId: string;
  authKey: string;
  value: string;
}

function getPluginsDir() {
  return path.join(getCacheRootDir(), "plugins");
}

async function upsertPluginPackage(
  db: AppDb,
  manifest: Awaited<ReturnType<typeof readManifest>>,
  installPath: string,
  sha256: string | null,
  sourceIndex: string,
) {
  const existing = await db
    .select()
    .from(pluginPackages)
    .where(eq(pluginPackages.pluginId, manifest.id))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(pluginPackages)
      .set({
        name: manifest.name,
        version: manifest.version,
        runtime: manifest.runtime,
        installPath,
        sha256,
        isNsfw: manifest.isNsfw,
        capabilities: manifest.capabilities as Record<string, boolean>,
        manifestRaw: manifest as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(pluginPackages.pluginId, manifest.id));
    return;
  }

  await db.insert(pluginPackages).values({
    pluginId: manifest.id,
    name: manifest.name,
    version: manifest.version,
    runtime: manifest.runtime,
    installPath,
    sha256,
    isNsfw: manifest.isNsfw,
    capabilities: manifest.capabilities as Record<string, boolean>,
    manifestRaw: manifest as unknown as Record<string, unknown>,
    enabled: true,
    sourceIndex,
  });
}

export async function installPluginPackageWrite(
  db: AppDb,
  input: InstallPluginPackageInput,
): Promise<{ ok: true; pluginId: string }> {
  const { pluginId, zipUrl, localPath, sha256: expectedSha } = input;
  const installDir = path.join(getPluginsDir(), pluginId);

  if (localPath) {
    if (!existsSync(localPath)) {
      throw new ValidationError(`Local plugin path not found: ${localPath}`);
    }

    try {
      const manifest = await readManifest(localPath);
      await upsertPluginPackage(db, manifest, localPath, null, "obscura-community");
      return { ok: true, pluginId: manifest.id };
    } catch (error) {
      throw new ValidationError(
        `Invalid plugin manifest: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (zipUrl) {
    const response = await fetch(zipUrl);
    if (!response.ok) {
      throw new UpstreamError(`Failed to download plugin: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    if (expectedSha) {
      const actual = createHash("sha256").update(buffer).digest("hex");
      if (actual !== expectedSha) {
        throw new ValidationError(
          `SHA256 mismatch: expected ${expectedSha}, got ${actual}`,
        );
      }
    }

    await mkdir(installDir, { recursive: true });
    const files = unzipSync(new Uint8Array(buffer));

    for (const [name, data] of Object.entries(files)) {
      const outPath = path.join(installDir, name);
      if (!outPath.startsWith(installDir)) continue;
      await mkdir(path.dirname(outPath), { recursive: true });
      await writeFile(outPath, data);
    }

    try {
      const manifest = await readManifest(installDir);
      const sha256 = createHash("sha256").update(buffer).digest("hex");
      await upsertPluginPackage(db, manifest, installDir, sha256, "obscura-community");
      return { ok: true, pluginId: manifest.id };
    } catch (error) {
      await rm(installDir, { recursive: true, force: true });
      throw new ValidationError(
        `Invalid plugin manifest: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  throw new ValidationError("Either zipUrl or localPath is required");
}

export async function deletePluginPackageWrite(
  db: AppDb,
  pluginDbId: string,
): Promise<{ ok: true }> {
  const [row] = await db
    .select()
    .from(pluginPackages)
    .where(eq(pluginPackages.id, pluginDbId))
    .limit(1);

  if (!row) {
    throw new NotFoundError("Plugin not found");
  }

  if (existsSync(row.installPath)) {
    await rm(row.installPath, { recursive: true, force: true });
  }

  await db.delete(pluginAuth).where(eq(pluginAuth.pluginId, row.pluginId));
  await db.delete(pluginPackages).where(eq(pluginPackages.id, row.id));

  return { ok: true };
}

export async function setPluginPackageEnabledWrite(
  db: AppDb,
  pluginDbId: string,
  enabled: boolean,
): Promise<{ ok: true }> {
  const [row] = await db
    .select()
    .from(pluginPackages)
    .where(eq(pluginPackages.id, pluginDbId))
    .limit(1);

  if (!row) {
    throw new NotFoundError("Plugin not found");
  }

  await db
    .update(pluginPackages)
    .set({ enabled, updatedAt: new Date() })
    .where(eq(pluginPackages.id, row.id));

  return { ok: true };
}

export async function getPluginAuthStatusesRead(db: AppDb, pluginDbId: string) {
  const [row] = await db
    .select()
    .from(pluginPackages)
    .where(eq(pluginPackages.id, pluginDbId))
    .limit(1);

  if (!row) {
    throw new NotFoundError("Plugin not found");
  }

  const manifest = row.manifestRaw as Record<string, unknown> | null;
  const authFields = Array.isArray(manifest?.auth)
    ? (manifest.auth as Array<{
        key: string;
        label: string;
        required: boolean;
        url?: string;
      }>)
    : [];

  const configuredKeys = await db
    .select({ authKey: pluginAuth.authKey })
    .from(pluginAuth)
    .where(eq(pluginAuth.pluginId, row.pluginId));

  const configuredSet = new Set(configuredKeys.map((entry) => entry.authKey));

  return authFields.map((field) => ({
    key: field.key,
    label: field.label,
    required: field.required,
    url: field.url,
    configured: configuredSet.has(field.key),
  }));
}

export async function setPluginAuthValueWrite(
  db: AppDb,
  input: SetPluginAuthValueInput,
): Promise<{ ok: true }> {
  const [row] = await db
    .select()
    .from(pluginPackages)
    .where(eq(pluginPackages.id, input.pluginDbId))
    .limit(1);

  if (!row) {
    throw new NotFoundError("Plugin not found");
  }

  const encryptedValue = encryptAuthValue(input.value);
  const existing = await db
    .select()
    .from(pluginAuth)
    .where(
      and(
        eq(pluginAuth.pluginId, row.pluginId),
        eq(pluginAuth.authKey, input.authKey),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(pluginAuth)
      .set({ encryptedValue, updatedAt: new Date() })
      .where(eq(pluginAuth.id, existing[0].id));
  } else {
    await db.insert(pluginAuth).values({
      pluginId: row.pluginId,
      authKey: input.authKey,
      encryptedValue,
    });
  }

  return { ok: true };
}
