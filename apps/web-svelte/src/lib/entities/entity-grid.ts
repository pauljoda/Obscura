import {
  getCapability,
  getImagesCapability,
  getRatingValue,
  getTechnicalCapability,
  getThumbnailUrl,
  isNsfw,
  type EntityCapabilityKind,
} from "$lib/api/capabilities";
import type { EntityCard, EntityCapability } from "$lib/api/generated/model";
import {
  iconForKind,
  type EntityThumbnailAsset,
  type EntityThumbnailCard,
  type EntityThumbnailMetaIcon,
} from "./entity-thumbnail";

/**
 * Sentinel kind used when an entity grid is showing every returned entity kind
 * instead of narrowing to one tab.
 */
export const ENTITY_GRID_ALL_KINDS = "all";

export type EntityGridSort = "title" | "kind" | "rating";
export type EntityGridSortDir = "asc" | "desc";
export type EntityGridViewMode = "grid" | "list";

export interface EntityGridKindTab {
  kind: string;
  label: string;
  count: number;
}

export interface EntityGridFilterOption {
  id: string;
  count: number;
  label: string;
  capabilityKind: EntityCapabilityKind;
  value?: string;
}

/**
 * Page-level action shown when one or more EntityGrid cards are selected.
 * Routes can provide contextual actions such as merge, add to collection, or
 * queue processing without changing the shared grid component.
 */
export interface EntityGridBulkAction {
  id: string;
  label: string;
  tone?: "default" | "danger";
  onRun: (selectedIds: string[]) => void;
}

export interface EntityGridState {
  activeKind: string;
  filterIds: string[];
  includeNsfw: boolean;
  query: string;
  sortBy: EntityGridSort;
  sortDir: EntityGridSortDir;
}

export interface EntityGridRequest {
  filters: EntityGridFilterOption[];
  kind?: string;
  query?: string;
  sortBy: EntityGridSort;
  sortDir: EntityGridSortDir;
}

const KIND_LABELS: Record<string, string> = {
  "audio-library": "Audio Libraries",
  "audio-track": "Audio Tracks",
  "book-chapter": "Book Chapters",
  "book-page": "Book Pages",
  "book-volume": "Book Volumes",
  book: "Books",
  collection: "Collections",
  gallery: "Galleries",
  image: "Images",
  person: "People",
  studio: "Studios",
  tag: "Tags",
  video: "Videos",
  "video-season": "Seasons",
  "video-series": "Series",
};

/**
 * Formats a backend entity kind code into the compact plural label shown in
 * EntityGrid tabs and lab surfaces.
 */
export function getEntityKindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind.replaceAll("-", " ").replace(/\b\w/g, (value) => value.toUpperCase());
}

function numberValue(value: number | string | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDuration(value: string | null | undefined): string | null {
  if (!value) return null;
  const [hours = "0", minutes = "0", seconds = "0"] = value.split(":");
  const roundedSeconds = seconds.split(".")[0] ?? "0";
  return hours === "00" || hours === "0"
    ? `${minutes.padStart(2, "0")}:${roundedSeconds.padStart(2, "0")}`
    : `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
}

function durationSeconds(value: string | null | undefined): number | null {
  if (!value) return null;
  const [hours = "0", minutes = "0", seconds = "0"] = value.split(":");
  const total =
    Number(hours) * 3600 +
    Number(minutes) * 60 +
    Number(seconds);
  return Number.isFinite(total) ? total : null;
}

function normalized(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replaceAll(".", "").replaceAll("-", "").replaceAll("_", "");
}

function statLabel(code: string, value: number | string): string {
  const count = String(value);
  const label = code.replaceAll("-", " ");
  return `${count} ${label}`;
}

function statIcon(code: string): EntityThumbnailMetaIcon {
  if (code.includes("track")) return "audio";
  if (code.includes("page")) return "book";
  if (code.includes("chapter")) return "chapter";
  if (code.includes("image")) return "gallery";
  if (code.includes("credit")) return "person";
  return "count";
}


function formatResolutionLabel(width: number, height: number): string {
  if (height >= 2160) return "4K";
  if (height >= 1440) return "1440p";
  if (height >= 1080) return "1080p";
  if (height >= 720) return "720p";
  if (height >= 480) return "480p";
  return `${width}×${height}`;
}

function aspectRatioForEntity(entity: EntityCard): EntityThumbnailCard["aspectRatio"] {
  const technical = getTechnicalCapability(entity.capabilities);
  const width = numberValue(technical?.width);
  const height = numberValue(technical?.height);

  if (entity.kind === "image" && width && height) return { width, height };
  if (entity.kind === "video") return "video";
  if (entity.kind === "video-series" || entity.kind === "video-season") return "poster";
  if (entity.kind.startsWith("book")) return "poster";
  if (entity.kind === "person") return "portrait";
  if (entity.kind === "studio") return "wide";
  if (entity.kind === "collection") return "video";
  return "square";
}

function assetFromPath(path: string, title: string, role?: string): EntityThumbnailAsset {
  return {
    alt: role ? `${title} ${role}` : title,
    role,
    src: path,
  };
}

function previewAssets(entity: EntityCard, roles: string[]): EntityThumbnailAsset[] {
  const images = getImagesCapability(entity.capabilities);
  if (!images) return [];

  const results: EntityThumbnailAsset[] = [];
  for (const item of images.items) {
    if (!roles.includes(item.kind)) continue;
    if (item.kind === "trickplay" && item.path.endsWith(".vtt")) continue;
    results.push(assetFromPath(item.path, entity.title, item.kind));
  }
  return results;
}

/** Finds the sprite URL and trickplay VTT URL from entity image assets when both exist. */
function findSpriteHover(entity: EntityCard): { spriteUrl: string; vttUrl: string } | null {
  const images = getImagesCapability(entity.capabilities);
  if (!images) return null;

  const vttItem = images.items.find((item) => item.kind === "trickplay" && item.path.endsWith(".vtt"));
  if (!vttItem) return null;

  const spriteItem = images.items.find((item) => item.kind === "sprite");
  const spriteUrl = spriteItem?.path ?? vttItem.path.replace(/\/[^/]+\.vtt$/, "/sprite");

  return { spriteUrl, vttUrl: vttItem.path };
}

function metaForEntity(entity: EntityCard): EntityThumbnailCard["meta"] {
  const meta: EntityThumbnailCard["meta"] = [];
  const technical = getTechnicalCapability(entity.capabilities);
  const duration = formatDuration(technical?.duration);
  const width = numberValue(technical?.width);
  const height = numberValue(technical?.height);
  const stats = getCapability(entity.capabilities, "stats")?.items ?? [];
  const positions = getCapability(entity.capabilities, "position")?.items ?? [];
  const customOverlay = customOverlayForEntity(entity);

  if (duration) meta.push({ icon: "duration", label: duration });
  if (width && height) meta.push({ icon: entity.kind === "video" ? "video" : "image", label: formatResolutionLabel(width, height) });
  for (const stat of stats.slice(0, 2)) {
    meta.push({ icon: statIcon(stat.code), label: statLabel(stat.code, stat.value) });
  }
  if (!customOverlay?.bottomLeft) {
    for (const position of positions.slice(0, 1)) {
      meta.push({ icon: iconForKind(entity.kind), label: position.label ?? `${position.code} ${position.value}` });
    }
  }

  return meta.slice(0, 3);
}

function positionValue(entity: EntityCard, code: string): number | null {
  const value = getCapability(entity.capabilities, "position")?.items.find((item) => item.code === code)?.value;
  return numberValue(value);
}

function customOverlayForEntity(entity: EntityCard): EntityThumbnailCard["custom"] {
  const season = positionValue(entity, "season");
  const episode = positionValue(entity, "episode") ?? positionValue(entity, "absolute-episode");

  if (entity.kind === "video" && season && episode) {
    return {
      bottomLeft: {
        label: `S${season} E${episode}`,
        title: `Season ${season}, Episode ${episode}`,
      },
    };
  }

  if (entity.kind === "video" && episode) {
    return {
      bottomLeft: {
        label: `E${episode}`,
        title: `Episode ${episode}`,
      },
    };
  }

  if (entity.kind === "video-season" && season) {
    return {
      bottomLeft: {
        label: `S${season}`,
        title: `Season ${season}`,
      },
    };
  }

  return undefined;
}

/**
 * Converts a generated v2 entity card into the shared thumbnail card model.
 * The mapper reads only shared capabilities so every entity kind can flow
 * through one thumbnail component.
 */
export function entityCardToThumbnailCard(
  entity: EntityCard,
  href?: string,
): EntityThumbnailCard {
  const images = getImagesCapability(entity.capabilities);
  // Use only explicit thumbnail/cover URLs from the backend. The items[0]
  // fallback is intentionally restricted to cover/poster/thumbnail roles —
  // generated assets like trickplay VTTs or previews should never be used as
  // a static cover image, and source files are not displayable thumbnails.
  const coverPath =
    getThumbnailUrl(entity.capabilities) ??
    images?.coverUrl ??
    images?.items.find((item) => item.kind === "cover" || item.kind === "poster" || item.kind === "thumbnail")?.path ??
    null;

  const spriteHover = findSpriteHover(entity);
  const imageSequence = previewAssets(entity, ["trickplay", "sprite"]);
  const hover: EntityThumbnailCard["hover"] = spriteHover
    ? { kind: "sprite", spriteUrl: spriteHover.spriteUrl, vttUrl: spriteHover.vttUrl }
    : imageSequence.length > 0
      ? { kind: "image-sequence", assets: imageSequence }
      : { kind: "none" };

  return {
    aspectRatio: aspectRatioForEntity(entity),
    cover: coverPath ? assetFromPath(coverPath, entity.title, "cover") : null,
    custom: customOverlayForEntity(entity),
    entity: {
      ...entity,
      capabilities: entity.capabilities,
    },
    fit: entity.kind === "video" || entity.kind === "collection" ? "cover" : "contain",
    hover,
    href,
    meta: metaForEntity(entity),
  };
}

/**
 * Builds the kind tab list from the entities returned by the current request.
 * Counts are intentionally local to the returned collection so mixed surfaces
 * can render their own scoped tabs.
 */
export function buildEntityKindTabs(
  cards: EntityThumbnailCard[],
  options: { includeNsfw?: boolean } = {},
): EntityGridKindTab[] {
  const counts = new Map<string, number>();
  for (const card of cards) {
    if (options.includeNsfw === false && isNsfw(card.entity.capabilities)) continue;
    counts.set(card.entity.kind, (counts.get(card.entity.kind) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([kind, count]) => ({ kind, label: getEntityKindLabel(kind), count }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function addOption(options: Map<string, EntityGridFilterOption>, option: Omit<EntityGridFilterOption, "count">) {
  const existing = options.get(option.id);
  if (existing) {
    options.set(option.id, { ...existing, count: existing.count + 1 });
  } else {
    options.set(option.id, { ...option, count: 1 });
  }
}

function addUniqueOption(options: Map<string, EntityGridFilterOption>, option: Omit<EntityGridFilterOption, "count">) {
  if (!options.has(option.id)) options.set(option.id, { ...option, count: 0 });
}

/**
 * Builds selectable filter chips from the capabilities actually present on the
 * returned cards. Counts reflect entities that would match the filter, not just
 * entities that support the capability family.
 */
export function buildCapabilityFilterOptions(cards: EntityThumbnailCard[]): EntityGridFilterOption[] {
  const options = new Map<string, EntityGridFilterOption>();
  const hasDates = true;
  const hasFiles = true;
  const hasFlags = cards.some((card) => Boolean(getCapability(card.entity.capabilities, "flags")));
  const hasProgress = true;
  const hasRating = cards.some((card) => getRatingValue(card.entity.capabilities) > 0);
  const hasTechnical = cards.some((card) => Boolean(getTechnicalCapability(card.entity.capabilities)));

  if (hasRating) {
    for (const value of [1, 2, 3, 4, 5]) {
      addUniqueOption(options, { id: `rating:min:${value}`, label: `${value}★+`, capabilityKind: "rating", value: `min:${value}` });
      addUniqueOption(options, { id: `rating:max:${value}`, label: `≤${value}★`, capabilityKind: "rating", value: `max:${value}` });
    }
  }

  if (hasTechnical) {
    for (const resolution of ["4K", "1080p", "720p", "480p"]) {
      addUniqueOption(options, {
        id: `technical:resolution:${resolution}`,
        label: resolution,
        capabilityKind: "technical",
        value: `resolution:${resolution}`,
      });
    }
    for (const duration of ["lt300", "300-900", "900-1800", "gte1800"]) {
      addUniqueOption(options, {
        id: `technical:duration:${duration}`,
        label: duration,
        capabilityKind: "technical",
        value: `duration:${duration}`,
      });
    }
  }

  if (hasDates) {
    addUniqueOption(options, { id: "dates:from", label: "Date from", capabilityKind: "dates", value: "from" });
    addUniqueOption(options, { id: "dates:to", label: "Date to", capabilityKind: "dates", value: "to" });
  }

  if (hasFiles) {
    addUniqueOption(options, { id: "files:has:true", label: "Has file", capabilityKind: "files", value: "has:true" });
    addUniqueOption(options, { id: "files:has:false", label: "No file", capabilityKind: "files", value: "has:false" });
  }

  if (hasProgress) {
    addUniqueOption(options, { id: "progress:played:true", label: "Played", capabilityKind: "progress", value: "played:true" });
    addUniqueOption(options, { id: "progress:played:false", label: "Unplayed", capabilityKind: "progress", value: "played:false" });
  }

  if (hasFlags) {
    addUniqueOption(options, { id: "flags:organized:true", label: "Organized", capabilityKind: "flags", value: "organized:true" });
    addUniqueOption(options, { id: "flags:organized:false", label: "Not organized", capabilityKind: "flags", value: "organized:false" });
    addUniqueOption(options, { id: "flags:nsfw:true", label: "Is NSFW", capabilityKind: "flags", value: "nsfw:true" });
    addUniqueOption(options, { id: "flags:nsfw:false", label: "Not NSFW", capabilityKind: "flags", value: "nsfw:false" });
  }

  for (const { entity } of cards) {
    for (const capability of entity.capabilities) {
      switch (capability.kind) {
        case "flags":
          if (capability.isFavorite) {
            addOption(options, { id: "flags:favorite", label: "Favorites", capabilityKind: "flags", value: "favorite" });
          }
          addOption(options, {
            id: `flags:organized:${capability.isOrganized ? "true" : "false"}`,
            label: capability.isOrganized ? "Organized" : "Not organized",
            capabilityKind: "flags",
            value: `organized:${capability.isOrganized ? "true" : "false"}`,
          });
          addOption(options, {
            id: `flags:nsfw:${capability.isNsfw ? "true" : "false"}`,
            label: capability.isNsfw ? "Is NSFW" : "Not NSFW",
            capabilityKind: "flags",
            value: `nsfw:${capability.isNsfw ? "true" : "false"}`,
          });
          if (capability.isOrganized) {
            addOption(options, { id: "flags:organized", label: "Organized", capabilityKind: "flags", value: "organized" });
          }
          if (capability.isNsfw) {
            addOption(options, { id: "flags:nsfw", label: "NSFW", capabilityKind: "flags", value: "nsfw" });
          }
          break;
        case "rating": {
          const ratingValue = numberValue(capability.value?.value);
          if (ratingValue && ratingValue > 0) {
            addOption(options, { id: "rating:any", label: "Rated", capabilityKind: "rating" });
            for (const value of [1, 2, 3, 4, 5]) {
              if (ratingValue >= value) {
                addOption(options, { id: `rating:min:${value}`, label: `${value}★+`, capabilityKind: "rating", value: `min:${value}` });
              }
              if (ratingValue <= value) {
                addOption(options, { id: `rating:max:${value}`, label: `≤${value}★`, capabilityKind: "rating", value: `max:${value}` });
              }
            }
          }
          if (ratingValue && ratingValue >= 4) {
            addOption(options, { id: "rating:4", label: "Rating 4+", capabilityKind: "rating", value: "4" });
          }
          break;
        }
        case "images":
          for (const role of new Set(capability.items.map((item) => item.kind))) {
            addOption(options, {
              id: `images:${role}`,
              label: `Has ${role} image`,
              capabilityKind: "images",
              value: role,
            });
          }
          break;
        case "tags":
          for (const tag of capability.values.slice(0, 24)) {
            addOption(options, { id: `tags:${tag}`, label: `Tag: ${tag}`, capabilityKind: "tags", value: tag });
          }
          break;
        case "credits":
          for (const person of capability.people) {
            addOption(options, { id: `credits:${person.id}`, label: person.title, capabilityKind: "credits", value: person.id });
          }
          break;
        case "studio":
          if (capability.value) {
            addOption(options, { id: `studio:${capability.value.id}`, label: capability.value.title, capabilityKind: "studio", value: capability.value.id });
          }
          break;
        case "stats":
          for (const stat of capability.items) {
            addOption(options, {
              id: `stats:${stat.code}`,
              label: `Has ${stat.code.replaceAll("-", " ")}`,
              capabilityKind: "stats",
              value: stat.code,
            });
          }
          break;
        case "technical":
          if (capability.duration) {
            addOption(options, { id: "technical:duration", label: "Has duration", capabilityKind: "technical", value: "duration" });
            const seconds = durationSeconds(capability.duration);
            if (seconds != null) {
              if (seconds < 300) addOption(options, { id: "technical:duration:lt300", label: "< 5 min", capabilityKind: "technical", value: "duration:lt300" });
              if (seconds >= 300 && seconds < 900) addOption(options, { id: "technical:duration:300-900", label: "5-15 min", capabilityKind: "technical", value: "duration:300-900" });
              if (seconds >= 900 && seconds < 1800) addOption(options, { id: "technical:duration:900-1800", label: "15-30 min", capabilityKind: "technical", value: "duration:900-1800" });
              if (seconds >= 1800) addOption(options, { id: "technical:duration:gte1800", label: "30+ min", capabilityKind: "technical", value: "duration:gte1800" });
            }
          }
          if (capability.width && capability.height) addOption(options, { id: "technical:dimensions", label: "Has dimensions", capabilityKind: "technical", value: "dimensions" });
          {
            const height = numberValue(capability.height);
            if (height) {
              if (height >= 2160) addOption(options, { id: "technical:resolution:4K", label: "4K", capabilityKind: "technical", value: "resolution:4K" });
              if (height >= 1080 && height < 2160) addOption(options, { id: "technical:resolution:1080p", label: "1080p", capabilityKind: "technical", value: "resolution:1080p" });
              if (height >= 720 && height < 1080) addOption(options, { id: "technical:resolution:720p", label: "720p", capabilityKind: "technical", value: "resolution:720p" });
              if (height > 0 && height < 720) addOption(options, { id: "technical:resolution:480p", label: "480p", capabilityKind: "technical", value: "resolution:480p" });
            }
          }
          if (capability.codec) addOption(options, { id: `technical:codec:${capability.codec}`, label: `Codec: ${capability.codec}`, capabilityKind: "technical", value: `codec:${capability.codec}` });
          break;
        case "dates":
          for (const date of capability.items) {
            addOption(options, {
              id: `dates:${date.code}`,
              label: `Has ${date.code.replaceAll("-", " ")} date`,
              capabilityKind: "dates",
              value: date.code,
            });
          }
          break;
        case "position":
          for (const position of capability.items) {
            addOption(options, {
              id: `position:${position.code}`,
              label: `Has ${position.code.replaceAll("-", " ")}`,
              capabilityKind: "position",
              value: position.code,
            });
          }
          break;
        case "classification":
          if (capability.value) {
            addOption(options, {
              id: `classification:${capability.value}`,
              label: `Classification: ${capability.value}`,
              capabilityKind: "classification",
              value: capability.value,
            });
          }
          break;
        case "files": {
          const hasEntityFile = capability.items.length > 0;
          addOption(options, {
            id: `files:has:${hasEntityFile ? "true" : "false"}`,
            label: hasEntityFile ? "Has file" : "No file",
            capabilityKind: "files",
            value: `has:${hasEntityFile ? "true" : "false"}`,
          });
          break;
        }
        case "progress":
          addOption(options, {
            id: `progress:played:${capability.completedAt ? "true" : "false"}`,
            label: capability.completedAt ? "Played" : "Unplayed",
            capabilityKind: "progress",
            value: `played:${capability.completedAt ? "true" : "false"}`,
          });
          break;
      }
    }
  }

  return [...options.values()].sort((left, right) => left.label.localeCompare(right.label));
}

/**
 * Resolves a persisted or dynamic filter ID into the full option metadata used
 * by chips, client-side lab filtering, and request serialization.
 */
export function entityGridFilterFromId(
  id: string,
  filterOptions: EntityGridFilterOption[],
): EntityGridFilterOption | undefined {
  const existing = filterOptions.find((option) => option.id === id);
  if (existing) return existing;

  const [family, key, value] = id.split(":");
  if (family === "dates" && (key === "from" || key === "to") && value) {
    return {
      id,
      count: 0,
      label: key === "from" ? `Date from ${value}` : `Date to ${value}`,
      capabilityKind: "dates",
      value: `${key}:${value}`,
    };
  }
  return undefined;
}

function entityMatchesFilter(capabilities: EntityCapability[], filter: EntityGridFilterOption): boolean {
  switch (filter.capabilityKind) {
    case "flags": {
      const flags = getCapability(capabilities, "flags");
      if (filter.value === "favorite") return flags?.isFavorite === true;
      if (filter.value === "organized:true") return flags?.isOrganized === true;
      if (filter.value === "organized:false") return flags?.isOrganized === false;
      if (filter.value === "nsfw:true") return flags?.isNsfw === true;
      if (filter.value === "nsfw:false") return flags?.isNsfw === false;
      if (filter.value === "organized") return flags?.isOrganized === true;
      if (filter.value === "nsfw") return flags?.isNsfw === true;
      return Boolean(flags);
    }
    case "rating": {
      const value = getRatingValue(capabilities);
      if (filter.value?.startsWith("min:")) return value >= Number(filter.value.slice("min:".length));
      if (filter.value?.startsWith("max:")) return value <= Number(filter.value.slice("max:".length));
      return filter.value ? value >= Number(filter.value) : value > 0;
    }
    case "images": {
      const images = getImagesCapability(capabilities);
      return Boolean(images && (!filter.value || images.items.some((item) => item.kind === filter.value)));
    }
    case "tags":
      return getCapability(capabilities, "tags")?.values.includes(filter.value ?? "") === true;
    case "credits":
      return getCapability(capabilities, "credits")?.people.some((person) => person.id === filter.value) === true;
    case "studio":
      return getCapability(capabilities, "studio")?.value?.id === filter.value;
    case "stats":
      return getCapability(capabilities, "stats")?.items.some((item) => item.code === filter.value) === true;
    case "technical": {
      const technical = getTechnicalCapability(capabilities);
      if (!technical) return false;
      if (filter.value === "duration") return Boolean(technical.duration);
      if (filter.value?.startsWith("duration:")) {
        const seconds = durationSeconds(technical.duration);
        if (seconds == null) return false;
        const bucket = filter.value.slice("duration:".length);
        if (bucket === "lt300") return seconds < 300;
        if (bucket === "300-900") return seconds >= 300 && seconds < 900;
        if (bucket === "900-1800") return seconds >= 900 && seconds < 1800;
        if (bucket === "gte1800") return seconds >= 1800;
      }
      if (filter.value === "dimensions") return Boolean(technical.width && technical.height);
      if (filter.value?.startsWith("resolution:")) {
        const height = numberValue(technical.height);
        if (!height) return false;
        const resolution = filter.value.slice("resolution:".length);
        if (resolution === "4K") return height >= 2160;
        if (resolution === "1080p") return height >= 1080 && height < 2160;
        if (resolution === "720p") return height >= 720 && height < 1080;
        if (resolution === "480p") return height > 0 && height < 720;
      }
      if (filter.value?.startsWith("codec:")) return normalized(technical.codec) === normalized(filter.value.slice("codec:".length));
      return true;
    }
    case "dates":
      if (filter.value?.startsWith("from:") || filter.value?.startsWith("to:")) {
        const [direction, date] = filter.value.split(":");
        const values = getCapability(capabilities, "dates")?.items.map((item) => item.sortableValue ?? item.value) ?? [];
        return values.some((candidate) => direction === "from" ? candidate >= date : candidate <= date);
      }
      return getCapability(capabilities, "dates")?.items.some((item) => item.code === filter.value) === true;
    case "files": {
      const hasFiles = (getCapability(capabilities, "files")?.items.length ?? 0) > 0;
      if (filter.value === "has:true") return hasFiles;
      if (filter.value === "has:false") return !hasFiles;
      return hasFiles;
    }
    case "progress": {
      const progress = getCapability(capabilities, "progress");
      if (filter.value === "played:true") return Boolean(progress?.completedAt);
      if (filter.value === "played:false") return !progress?.completedAt;
      return Boolean(progress);
    }
    case "position":
      return getCapability(capabilities, "position")?.items.some((item) => item.code === filter.value) === true;
    case "classification":
      return getCapability(capabilities, "classification")?.value === filter.value;
    default:
      return capabilities.some((capability) => capability.kind === filter.capabilityKind);
  }
}

/**
 * Applies the client-side version of EntityGrid state for lab and optimistic UI
 * paths. Server-backed endpoints own privacy filtering from server-side
 * settings, so this helper is only a local display fallback for cards the
 * client already has.
 */
export function applyEntityGridState(
  cards: EntityThumbnailCard[],
  state: EntityGridState,
  filterOptions = buildCapabilityFilterOptions(cards),
): EntityThumbnailCard[] {
  const query = state.query.trim().toLowerCase();
  const filters = state.filterIds
    .map((id) => entityGridFilterFromId(id, filterOptions))
    .filter((option): option is EntityGridFilterOption => Boolean(option));

  const filtered = cards.filter((card) => {
    if (!state.includeNsfw && isNsfw(card.entity.capabilities)) return false;
    if (state.activeKind !== ENTITY_GRID_ALL_KINDS && card.entity.kind !== state.activeKind) return false;
    if (query && !card.entity.title.toLowerCase().includes(query)) return false;
    return filters.every((filter) => entityMatchesFilter(card.entity.capabilities, filter));
  });

  return filtered.toSorted((left, right) => {
    const direction = state.sortDir === "asc" ? 1 : -1;
    if (state.sortBy === "rating") {
      return (getRatingValue(left.entity.capabilities) - getRatingValue(right.entity.capabilities)) * direction;
    }
    if (state.sortBy === "kind") {
      return left.entity.kind.localeCompare(right.entity.kind) * direction || left.entity.title.localeCompare(right.entity.title);
    }
    return left.entity.title.localeCompare(right.entity.title) * direction;
  });
}

/**
 * Serializes the current grid controls into the non-privacy request shape
 * expected by v2 list endpoints and by the thumbnail lab state preview.
 */
export function entityGridRequestFromState(
  state: EntityGridState,
  filterOptions: EntityGridFilterOption[],
): EntityGridRequest {
  return {
    filters: state.filterIds
      .map((id) => entityGridFilterFromId(id, filterOptions))
      .filter((option): option is EntityGridFilterOption => Boolean(option)),
    kind: state.activeKind === ENTITY_GRID_ALL_KINDS ? undefined : state.activeKind,
    query: state.query.trim() || undefined,
    sortBy: state.sortBy,
    sortDir: state.sortDir,
  };
}
