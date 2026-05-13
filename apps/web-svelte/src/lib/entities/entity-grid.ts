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
import type {
  EntityThumbnailAsset,
  EntityThumbnailCard,
  EntityThumbnailMetaIcon,
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
  includeNsfw: boolean;
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

function iconForKind(kind: string): EntityThumbnailMetaIcon {
  if (kind.startsWith("audio")) return "audio";
  if (kind.startsWith("book")) return "book";
  if (kind.startsWith("video")) return "video";
  if (kind === "gallery") return "gallery";
  if (kind === "image") return "image";
  if (kind === "person") return "person";
  if (kind === "studio") return "studio";
  if (kind === "tag") return "tag";
  return "collection";
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
  return images.items
    .filter((item) => roles.includes(item.kind))
    .map((item) => assetFromPath(item.path, entity.title, item.kind));
}

function metaForEntity(entity: EntityCard): EntityThumbnailCard["meta"] {
  const meta: EntityThumbnailCard["meta"] = [];
  const technical = getTechnicalCapability(entity.capabilities);
  const duration = formatDuration(technical?.duration);
  const width = numberValue(technical?.width);
  const height = numberValue(technical?.height);
  const stats = getCapability(entity.capabilities, "stats")?.items ?? [];
  const positions = getCapability(entity.capabilities, "position")?.items ?? [];

  if (duration) meta.push({ icon: "duration", label: duration });
  if (width && height) meta.push({ icon: entity.kind === "video" ? "video" : "image", label: `${width}x${height}` });
  for (const stat of stats.slice(0, 2)) {
    meta.push({ icon: statIcon(stat.code), label: statLabel(stat.code, stat.value) });
  }
  for (const position of positions.slice(0, 1)) {
    meta.push({ icon: iconForKind(entity.kind), label: position.label ?? `${position.code} ${position.value}` });
  }

  return meta.slice(0, 3);
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
  const coverPath =
    getThumbnailUrl(entity.capabilities) ??
    images?.coverUrl ??
    images?.items.find((item) => item.kind === "cover")?.path ??
    images?.items[0]?.path ??
    null;
  const trickplay = previewAssets(entity, ["trickplay", "sprite"]);
  const sequence = previewAssets(entity, ["preview", "page", "still", "poster"]);
  const hoverAssets = trickplay.length > 0 ? trickplay : sequence;

  return {
    aspectRatio: aspectRatioForEntity(entity),
    cover: coverPath ? assetFromPath(coverPath, entity.title, "cover") : null,
    entity: {
      ...entity,
      capabilities: entity.capabilities,
    },
    fit: entity.kind === "video" || entity.kind === "collection" ? "cover" : "contain",
    hover:
      hoverAssets.length === 0
        ? { kind: "none" }
        : { kind: trickplay.length > 0 ? "trickplay" : "image-sequence", assets: hoverAssets },
    href,
    meta: metaForEntity(entity),
  };
}

/**
 * Builds the kind tab list from the entities returned by the current request.
 * Counts are intentionally local to the returned collection so mixed surfaces
 * can render their own scoped tabs.
 */
export function buildEntityKindTabs(cards: EntityThumbnailCard[]): EntityGridKindTab[] {
  const counts = new Map<string, number>();
  for (const card of cards) {
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

/**
 * Builds selectable filter chips from the capabilities actually present on the
 * returned cards. Counts reflect entities that would match the filter, not just
 * entities that support the capability family.
 */
export function buildCapabilityFilterOptions(cards: EntityThumbnailCard[]): EntityGridFilterOption[] {
  const options = new Map<string, EntityGridFilterOption>();

  for (const { entity } of cards) {
    for (const capability of entity.capabilities) {
      switch (capability.kind) {
        case "flags":
          if (capability.isFavorite) {
            addOption(options, { id: "flags:favorite", label: "Favorites", capabilityKind: "flags", value: "favorite" });
          }
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
          if (capability.duration) addOption(options, { id: "technical:duration", label: "Has duration", capabilityKind: "technical", value: "duration" });
          if (capability.width && capability.height) addOption(options, { id: "technical:dimensions", label: "Has dimensions", capabilityKind: "technical", value: "dimensions" });
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
      }
    }
  }

  return [...options.values()].sort((left, right) => left.label.localeCompare(right.label));
}

function entityMatchesFilter(capabilities: EntityCapability[], filter: EntityGridFilterOption): boolean {
  switch (filter.capabilityKind) {
    case "flags": {
      const flags = getCapability(capabilities, "flags");
      if (filter.value === "favorite") return flags?.isFavorite === true;
      if (filter.value === "organized") return flags?.isOrganized === true;
      if (filter.value === "nsfw") return flags?.isNsfw === true;
      return Boolean(flags);
    }
    case "rating": {
      const value = getRatingValue(capabilities);
      return filter.value ? value >= Number(filter.value) : value > 0;
    }
    case "images": {
      const images = getImagesCapability(capabilities);
      return Boolean(images && (!filter.value || images.items.some((item) => item.kind === filter.value)));
    }
    case "tags":
      return getCapability(capabilities, "tags")?.values.includes(filter.value ?? "") === true;
    case "stats":
      return getCapability(capabilities, "stats")?.items.some((item) => item.code === filter.value) === true;
    case "technical": {
      const technical = getTechnicalCapability(capabilities);
      if (!technical) return false;
      if (filter.value === "duration") return Boolean(technical.duration);
      if (filter.value === "dimensions") return Boolean(technical.width && technical.height);
      if (filter.value?.startsWith("codec:")) return technical.codec === filter.value.slice("codec:".length);
      return true;
    }
    case "dates":
      return getCapability(capabilities, "dates")?.items.some((item) => item.code === filter.value) === true;
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
 * paths. Real endpoints receive the same state through {@link EntityGridRequest}
 * so filtering can move server-side without changing the component contract.
 */
export function applyEntityGridState(
  cards: EntityThumbnailCard[],
  state: EntityGridState,
  filterOptions = buildCapabilityFilterOptions(cards),
): EntityThumbnailCard[] {
  const query = state.query.trim().toLowerCase();
  const filters = state.filterIds
    .map((id) => filterOptions.find((option) => option.id === id))
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
 * Serializes the current grid controls into the request shape expected by v2
 * list endpoints and by the thumbnail lab state preview.
 */
export function entityGridRequestFromState(
  state: EntityGridState,
  filterOptions: EntityGridFilterOption[],
): EntityGridRequest {
  return {
    filters: state.filterIds
      .map((id) => filterOptions.find((option) => option.id === id))
      .filter((option): option is EntityGridFilterOption => Boolean(option)),
    includeNsfw: state.includeNsfw,
    kind: state.activeKind === ENTITY_GRID_ALL_KINDS ? undefined : state.activeKind,
    query: state.query.trim() || undefined,
    sortBy: state.sortBy,
    sortDir: state.sortDir,
  };
}
