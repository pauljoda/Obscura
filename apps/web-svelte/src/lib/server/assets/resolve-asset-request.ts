import { existsSync } from "node:fs";
import path from "node:path";
import {
  VIDEO_GENERATED_FILENAMES,
  extractZipMember,
  getCacheRootCandidates,
  getVideoGeneratedDiskPaths,
} from "@obscura/media-core";
import {
  IMAGE_EXTENSIONS,
  firstExistingPath,
  mimeForFile,
  notFound,
  sendBuffer,
  streamFile,
  streamFileWithRange,
} from "./asset-response";
import {
  MUTABLE_ASSET_CACHE_CONTROL,
  PRIVATE_DAILY_IMMUTABLE_ASSET_CACHE_CONTROL,
  PRIVATE_HOURLY_ASSET_CACHE_CONTROL,
  PRIVATE_IMMUTABLE_ASSET_CACHE_CONTROL,
} from "$lib/server/cache-policy";

const SIDECAR_MIME: Record<SidecarKind, string> = {
  thumb: "image/jpeg",
  card: "image/jpeg",
  sprite: "image/jpeg",
  preview: "video/mp4",
  trickplay: "text/vtt",
};

type SidecarKind = "thumb" | "card" | "sprite" | "preview" | "trickplay";

const KIND_TO_DISK_KEY: Record<
  SidecarKind,
  "thumb" | "card" | "sprite" | "preview" | "trickplay"
> = {
  thumb: "thumb",
  card: "card",
  sprite: "sprite",
  preview: "preview",
  trickplay: "trickplay",
};

const LEGACY_NAME_MAP: Record<string, SidecarKind> = {
  "thumbnail.jpg": "thumb",
  "sprite.jpg": "sprite",
  "preview.mp4": "preview",
  "trickplay.vtt": "trickplay",
};

export interface AssetResolverDeps {
  resolveVideoFilePath(id: string): Promise<string | null>;
  getMetadataStorageDedicated(): Promise<boolean>;
  getGalleryCover(
    id: string,
  ): Promise<{ found: boolean; coverImageId: string | null }>;
  getImageRecord(
    id: string,
  ): Promise<{ filePath: string; format: string | null } | null>;
  getCollectionDetail(id: string): Promise<{ coverImagePath: string | null }>;
}

function isSidecarKind(value: string): value is SidecarKind {
  return value in SIDECAR_MIME;
}

function serveFileIfExists(
  filePath: string,
  headers: Record<string, string>,
  errorMessage: string,
): Response {
  if (!existsSync(filePath)) {
    return notFound(errorMessage);
  }
  return streamFile(filePath, headers);
}

function serveFirstMatchingFile(
  candidates: string[],
  errorMessage: string,
  cacheControl = "no-cache",
): Response {
  const filePath = firstExistingPath(candidates);
  if (!filePath) {
    return notFound(errorMessage);
  }
  return streamFile(filePath, {
    "Cache-Control": cacheControl,
    "Content-Type": mimeForFile(filePath),
  });
}

function serveEntityImage(dir: string, entityLabel: string): Response {
  const candidates: string[] = [];
  for (const base of ["image", "profile"]) {
    for (const ext of IMAGE_EXTENSIONS) {
      candidates.push(path.join(dir, `${base}.${ext}`));
    }
  }

  const filePath = firstExistingPath(candidates);
  if (!filePath) {
    return notFound(`${entityLabel} image not found`);
  }

  return streamFile(filePath, {
    "Cache-Control": MUTABLE_ASSET_CACHE_CONTROL,
    "Content-Type": mimeForFile(filePath),
  });
}

function cacheCandidates(...parts: string[]) {
  return getCacheRootCandidates().map((root) => path.join(root, ...parts));
}

async function handleVideoAsset(
  deps: AssetResolverDeps,
  id: string,
  kind: string,
  range: string | null,
): Promise<Response> {
  if (kind === "thumb-custom") {
    return serveFirstMatchingFile(
      [
        ...cacheCandidates("videos", id, "thumbnail-custom.jpg"),
        ...cacheCandidates("scenes", id, "thumbnail-custom.jpg"),
      ],
      "Custom thumbnail not found",
      MUTABLE_ASSET_CACHE_CONTROL,
    );
  }

  const resolvedKind = LEGACY_NAME_MAP[kind] ?? kind;
  if (!isSidecarKind(resolvedKind)) {
    return notFound("Unknown asset kind");
  }

  const filePath = await deps.resolveVideoFilePath(id);
  if (!filePath) {
    return notFound("Video not found");
  }

  const dedicatedPrimary = await deps.getMetadataStorageDedicated();
  const primary = getVideoGeneratedDiskPaths(
    id,
    filePath,
    dedicatedPrimary ? "dedicated" : "sidecar",
  );
  const secondary = getVideoGeneratedDiskPaths(
    id,
    filePath,
    dedicatedPrimary ? "sidecar" : "dedicated",
  );

  const diskKey = KIND_TO_DISK_KEY[resolvedKind];
  const primaryPath = primary[diskKey];
  const secondaryPath = secondary[diskKey];
  const legacyDedicatedFileName =
    resolvedKind === "thumb"
      ? VIDEO_GENERATED_FILENAMES.thumb
      : resolvedKind === "card"
        ? VIDEO_GENERATED_FILENAMES.card
        : resolvedKind === "sprite"
          ? VIDEO_GENERATED_FILENAMES.sprite
          : resolvedKind === "preview"
            ? VIDEO_GENERATED_FILENAMES.preview
            : VIDEO_GENERATED_FILENAMES.trickplay;
  const legacyDedicatedCandidates = cacheCandidates(
    "videos",
    id,
    legacyDedicatedFileName,
  );
  const legacySceneDedicatedCandidates = cacheCandidates(
    "scenes",
    id,
    legacyDedicatedFileName,
  );
  const selectedPath = firstExistingPath([
    primaryPath,
    secondaryPath,
    ...legacyDedicatedCandidates,
    ...legacySceneDedicatedCandidates,
  ]);
  if (!selectedPath) {
    return notFound("Asset not found");
  }

  const sidecarHeaders = {
    "Cache-Control": PRIVATE_IMMUTABLE_ASSET_CACHE_CONTROL,
    "Content-Type": SIDECAR_MIME[resolvedKind],
  };
  if (resolvedKind === "preview") {
    return streamFileWithRange(selectedPath, sidecarHeaders, range);
  }
  return streamFile(selectedPath, sidecarHeaders);
}

async function handleGalleryCover(
  deps: AssetResolverDeps,
  id: string,
): Promise<Response> {
  // Custom uploaded cover takes precedence over the linked image thumb.
  const customPath = firstExistingPath(
    cacheCandidates("galleries", id, "cover-custom.jpg"),
  );
  if (customPath) {
    return streamFile(customPath, {
      "Cache-Control": MUTABLE_ASSET_CACHE_CONTROL,
      "Content-Type": "image/jpeg",
    });
  }

  const gallery = await deps.getGalleryCover(id);
  if (!gallery.found) {
    return notFound("Gallery not found");
  }
  if (!gallery.coverImageId) {
    return notFound("No cover image available");
  }

  const coverThumb = firstExistingPath([
    ...cacheCandidates("images", gallery.coverImageId, "thumb-custom.jpg"),
    ...cacheCandidates("images", gallery.coverImageId, "thumb.jpg"),
  ]);
  if (!coverThumb) {
    return notFound("Cover thumbnail not yet generated");
  }
  return streamFile(coverThumb, {
    "Cache-Control": MUTABLE_ASSET_CACHE_CONTROL,
    "Content-Type": "image/jpeg",
  });
}

async function handleImageAsset(
  deps: AssetResolverDeps,
  id: string,
  kind: string,
  range: string | null,
): Promise<Response> {
  if (kind === "thumb") {
    const thumbPath = firstExistingPath([
      ...cacheCandidates("images", id, "thumb-custom.jpg"),
      ...cacheCandidates("images", id, "thumb.jpg"),
    ]);
    if (!thumbPath) {
      return notFound("Image thumbnail not found");
    }
    return streamFile(thumbPath, {
      "Cache-Control": MUTABLE_ASSET_CACHE_CONTROL,
      "Content-Type": "image/jpeg",
    });
  }

  if (kind === "preview") {
    const previewPath = firstExistingPath(cacheCandidates("images", id, "preview.mp4"));
    if (!previewPath) {
      return notFound("Image preview not found");
    }
    return streamFileWithRange(
      previewPath,
      {
        "Cache-Control": PRIVATE_DAILY_IMMUTABLE_ASSET_CACHE_CONTROL,
        "Content-Type": "video/mp4",
      },
      range,
    );
  }

  if (kind !== "full") {
    return notFound("Unknown asset kind");
  }

  const image = await deps.getImageRecord(id);
  if (!image) {
    return notFound("Image not found");
  }

  if (image.filePath.includes("::")) {
    const [zipPath, memberPath] = image.filePath.split("::");
    const data = extractZipMember(zipPath, memberPath);
    if (!data) {
      return notFound("Image not available");
    }

    return sendBuffer(data, {
      "Cache-Control": PRIVATE_HOURLY_ASSET_CACHE_CONTROL,
      "Content-Type": mimeForFile(memberPath),
    });
  }

  if (!existsSync(image.filePath)) {
    return notFound("Image file not found");
  }

  const contentType = mimeForFile(image.filePath);
  const headers = {
    "Cache-Control": PRIVATE_HOURLY_ASSET_CACHE_CONTROL,
    "Content-Type": contentType,
  };
  if (contentType.startsWith("video/")) {
    return streamFileWithRange(image.filePath, headers, range);
  }
  return streamFile(image.filePath, headers);
}

async function handleCollectionCover(
  deps: AssetResolverDeps,
  id: string,
): Promise<Response> {
  const collection = await deps.getCollectionDetail(id);
  if (!collection.coverImagePath) {
    return notFound("No cover image");
  }

  return serveFirstMatchingFile(
    [
      ...cacheCandidates("collections", id, "cover-custom.jpg"),
      ...cacheCandidates("collections", id, "cover.webp"),
    ],
    "Cover file not found",
    MUTABLE_ASSET_CACHE_CONTROL,
  );
}

export async function resolveAssetRequest(
  deps: AssetResolverDeps,
  assetPath: string,
  range: string | null = null,
): Promise<Response> {
  const segments = assetPath.split("/").filter(Boolean);
  if (segments.length === 0) {
    return notFound("Asset not found");
  }

  const [family, id, kind] = segments;

  if ((family === "videos" || family === "scenes") && segments.length === 3) {
    return handleVideoAsset(deps, id, kind, range);
  }

  if (family === "performers" && segments.length === 3) {
    return kind === "image"
      ? serveEntityImage(
          firstExistingPath(cacheCandidates("performers", id)) ??
            path.join("__missing__", id),
          "Actor",
        )
      : notFound("Unknown asset kind");
  }

  if (family === "studios" && segments.length === 3) {
    return kind === "image"
      ? serveEntityImage(
          firstExistingPath(cacheCandidates("studios", id)) ??
            path.join("__missing__", id),
          "Studio",
        )
      : notFound("Unknown asset kind");
  }

  if (family === "tags" && segments.length === 3) {
    return kind === "image"
      ? serveEntityImage(
          firstExistingPath(cacheCandidates("tags", id)) ??
            path.join("__missing__", id),
          "Tag",
        )
      : notFound("Unknown asset kind");
  }

  if (family === "galleries" && segments.length === 3 && kind === "cover") {
    return handleGalleryCover(deps, id);
  }

  if (family === "images" && segments.length === 3) {
    return handleImageAsset(deps, id, kind, range);
  }

  if (family === "audio-libraries" && segments.length === 3 && kind === "cover") {
    return serveFileIfExists(
      firstExistingPath(cacheCandidates("audio-libraries", id, "cover-custom.jpg")) ??
        path.join("__missing__", "cover-custom.jpg"),
      {
        "Cache-Control": MUTABLE_ASSET_CACHE_CONTROL,
        "Content-Type": "image/jpeg",
      },
      "Cover not found",
    );
  }

  if (
    family === "video-series" &&
    segments.length === 3 &&
    (kind === "cover" || kind === "backdrop")
  ) {
    const prefix = kind === "cover" ? "Cover" : "Backdrop";
    const baseName = kind === "cover" ? "poster" : "backdrop";
    return serveFirstMatchingFile(
      [
        ...cacheCandidates("video-series", id, `${kind}-custom.jpg`),
        ...cacheCandidates("video-series", id, `${baseName}.jpg`),
        ...cacheCandidates("video-series", id, `${baseName}.png`),
        ...cacheCandidates("video-series", id, `${baseName}.webp`),
      ],
      `${prefix} not found`,
      MUTABLE_ASSET_CACHE_CONTROL,
    );
  }

  if (
    family === "video-folders" &&
    segments.length === 3 &&
    (kind === "cover" || kind === "backdrop")
  ) {
    const prefix = kind === "cover" ? "Cover" : "Backdrop";
    const baseName = kind === "cover" ? "poster" : "backdrop";
    return serveFirstMatchingFile(
      [
        ...cacheCandidates("video-series", id, `${kind}-custom.jpg`),
        ...cacheCandidates("video-series", id, `${baseName}.jpg`),
        ...cacheCandidates("video-series", id, `${baseName}.png`),
        ...cacheCandidates("video-series", id, `${baseName}.webp`),
      ],
      `${prefix} not found`,
      MUTABLE_ASSET_CACHE_CONTROL,
    );
  }

  if (family === "seasons" && segments.length === 3 && kind === "poster") {
    return serveFirstMatchingFile(
      [
        ...cacheCandidates("seasons", id, "poster.jpg"),
        ...cacheCandidates("seasons", id, "poster.jpeg"),
        ...cacheCandidates("seasons", id, "poster.png"),
        ...cacheCandidates("seasons", id, "poster.webp"),
      ],
      "Season poster not found",
      MUTABLE_ASSET_CACHE_CONTROL,
    );
  }

  if (
    family === "audio-tracks" &&
    segments.length === 3 &&
    kind === "waveform.json"
  ) {
    return serveFileIfExists(
      firstExistingPath(cacheCandidates("audio-tracks", id, "waveform.json")) ??
        path.join("__missing__", "waveform.json"),
      {
        "Cache-Control": PRIVATE_DAILY_IMMUTABLE_ASSET_CACHE_CONTROL,
        "Content-Type": "application/json",
      },
      "Waveform not found",
    );
  }

  if (family === "collections" && segments.length === 3 && kind === "cover") {
    return handleCollectionCover(deps, id);
  }

  return notFound("Asset not found");
}
