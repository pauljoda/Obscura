import type { EntityCapability } from "$lib/api/generated/model";
import type {
  EntityThumbnailAsset,
  EntityThumbnailCard,
  EntityThumbnailMetaItem,
} from "./entity-thumbnail";

/** One lab row that groups thumbnail examples by v2 entity kind. */
export interface EntityThumbnailRow {
  kind: string;
  label: string;
  cards: EntityThumbnailCard[];
}

function svgArt(label: string, primary: string, secondary: string, accent: string): string {
  const safeLabel = label.replace(/[<>&"]/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${primary}"/><stop offset="1" stop-color="${secondary}"/></linearGradient><filter id="grain"><feTurbulence baseFrequency=".8" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter></defs><rect width="960" height="540" fill="url(#g)"/><rect width="960" height="540" opacity=".13" filter="url(#grain)"/><path d="M70 450 C210 300 280 360 410 220 S670 120 895 260" fill="none" stroke="${accent}" stroke-width="18" opacity=".72"/><circle cx="746" cy="138" r="74" fill="${accent}" opacity=".34"/><rect x="72" y="72" width="380" height="70" fill="#050505" opacity=".5"/><text x="96" y="120" fill="#f4efe6" font-family="Inter,Arial,sans-serif" font-size="38" font-weight="700">${safeLabel}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function asset(label: string, primary: string, secondary: string, accent = "#c49a5a"): EntityThumbnailAsset {
  return {
    src: svgArt(label, primary, secondary, accent),
    alt: label,
  };
}

function sequence(label: string, palette: [string, string, string], count: number): EntityThumbnailAsset[] {
  return Array.from({ length: count }, (_, index) =>
    asset(`${label} ${index + 1}`, palette[(index + 0) % palette.length], palette[(index + 1) % palette.length], palette[(index + 2) % palette.length]),
  );
}

function rating(value: number): EntityCapability {
  return {
    kind: "rating",
    value: { value },
  };
}

function flags(options: { isNsfw?: boolean; isFavorite?: boolean; isOrganized?: boolean } = {}): EntityCapability {
  return {
    kind: "flags",
    isFavorite: options.isFavorite ?? null,
    isNsfw: options.isNsfw ?? null,
    isOrganized: options.isOrganized ?? null,
  };
}

function images(
  supportedKinds: string[],
  cover: EntityThumbnailAsset,
  extraAssets: EntityThumbnailAsset[] = [],
  extraRole = "preview",
): EntityCapability {
  return {
    kind: "images",
    supportedKinds,
    thumbnailUrl: cover.src,
    coverUrl: cover.src,
    items: [
      { kind: "cover", path: cover.src, mimeType: "image/svg+xml" },
      ...extraAssets.map((item, index) => ({
        kind: supportedKinds.includes(extraRole) ? extraRole : (supportedKinds[index % supportedKinds.length] ?? "preview"),
        path: item.src,
        mimeType: "image/svg+xml",
      })),
    ],
  };
}

function stats(items: Array<{ code: string; value: number }>): EntityCapability {
  return {
    kind: "stats",
    items,
  };
}

function technical(options: { duration?: string; width?: number; height?: number; codec?: string; format?: string }): EntityCapability {
  return {
    kind: "technical",
    duration: options.duration ?? null,
    width: options.width ?? null,
    height: options.height ?? null,
    frameRate: null,
    bitRate: null,
    sampleRate: null,
    channels: null,
    codec: options.codec ?? null,
    container: null,
    format: options.format ?? null,
  };
}

function position(code: string, value: number, label: string): EntityCapability {
  return {
    kind: "position",
    items: [{ code, value, label }],
  };
}

function card(options: {
  id: string;
  kind: string;
  title: string;
  subtitle?: string;
  aspectRatio: EntityThumbnailCard["aspectRatio"];
  cover: EntityThumbnailAsset;
  hover?: EntityThumbnailCard["hover"];
  supportedImageKinds?: string[];
  flagOptions?: Parameters<typeof flags>[0];
  capabilities?: EntityCapability[];
  meta?: EntityThumbnailMetaItem[];
}): EntityThumbnailCard {
  const hover = options.hover ?? { kind: "none" };
  const hoverAssets = hover.kind === "none" ? [] : hover.assets;
  const hoverRole = hover.kind === "trickplay" ? "trickplay" : "preview";
  const supportedImageKinds =
    options.supportedImageKinds ??
    Array.from(new Set(["cover", ...(hoverAssets.length > 0 ? [hoverRole] : [])]));
  return {
    entity: {
      id: options.id,
      kind: options.kind,
      title: options.title,
      subtitle: options.subtitle ?? null,
      capabilities: [
        flags(options.flagOptions),
        images(supportedImageKinds, options.cover, hoverAssets, hoverRole),
        ...(options.capabilities ?? []),
      ],
    },
    aspectRatio: options.aspectRatio,
    cover: options.cover,
    hover,
    meta: options.meta,
  };
}

const brass = "#c49a5a";
const forest = "#293f32";
const burgundy = "#522b34";
const indigo = "#26344f";
const ember = "#7b4a24";
const graphite = "#1f2226";

/** Safe synthetic thumbnail data for exercising the v2 shared entity-card surface without touching user media. */
export const thumbnailLabRows: EntityThumbnailRow[] = [
  {
    kind: "video",
    label: "Videos",
    cards: [
      card({
        id: "video-big-buck",
        kind: "video",
        title: "Big Buck Bunny Sample",
        subtitle: "Open movie fixture",
        aspectRatio: "video",
        cover: asset("Big Buck Bunny", forest, graphite, brass),
        hover: { kind: "trickplay", assets: sequence("Trickplay", [forest, ember, indigo], 6) },
        capabilities: [rating(4), technical({ duration: "00:09:56", width: 1920, height: 1080, codec: "h264" })],
        meta: [
          { icon: "duration", label: "09:56" },
          { icon: "video", label: "1080p" },
        ],
      }),
    ],
  },
  {
    kind: "video-series",
    label: "Video Series",
    cards: [
      card({
        id: "series-demo",
        kind: "video-series",
        title: "Demo Shorts",
        subtitle: "Series shell",
        aspectRatio: "poster",
        cover: asset("Demo Shorts", burgundy, graphite, brass),
        capabilities: [rating(5), stats([{ code: "videos", value: 8 }])],
        meta: [{ icon: "count", label: "8 videos" }],
      }),
    ],
  },
  {
    kind: "video-season",
    label: "Video Seasons",
    cards: [
      card({
        id: "season-01",
        kind: "video-season",
        title: "Season 01",
        subtitle: "Ordered child group",
        aspectRatio: "video",
        cover: asset("Season 01", indigo, graphite, brass),
        capabilities: [position("season", 1, "Season 1"), stats([{ code: "episodes", value: 6 }])],
        meta: [
          { icon: "chapter", label: "S01" },
          { icon: "count", label: "6 episodes" },
        ],
      }),
    ],
  },
  {
    kind: "gallery",
    label: "Galleries",
    cards: [
      card({
        id: "gallery-stock",
        kind: "gallery",
        title: "Fixture Landscapes",
        subtitle: "Preview sequence",
        aspectRatio: "square",
        cover: asset("Gallery Cover", ember, graphite, brass),
        hover: { kind: "image-sequence", assets: sequence("Gallery", [ember, forest, indigo], 5) },
        capabilities: [stats([{ code: "images", value: 42 }])],
        meta: [{ icon: "gallery", label: "42 images" }],
      }),
    ],
  },
  {
    kind: "image",
    label: "Images",
    cards: [
      card({
        id: "image-still",
        kind: "image",
        title: "Sample Still",
        subtitle: "Single image entity",
        aspectRatio: { width: 4, height: 3 },
        cover: asset("Image Still", forest, indigo, brass),
        capabilities: [rating(3), technical({ width: 1600, height: 1200, format: "jpeg" })],
        meta: [{ icon: "image", label: "1600x1200" }],
      }),
    ],
  },
  {
    kind: "book",
    label: "Books",
    cards: [
      card({
        id: "book-fixture",
        kind: "book",
        title: "Public Domain Reader",
        subtitle: "Book root",
        aspectRatio: "poster",
        cover: asset("Book Cover", burgundy, ember, brass),
        hover: { kind: "image-sequence", assets: sequence("Pages", [burgundy, graphite, forest], 4) },
        capabilities: [stats([{ code: "pages", value: 128 }, { code: "chapters", value: 9 }])],
        meta: [
          { icon: "book", label: "128 pages" },
          { icon: "chapter", label: "9 chapters" },
        ],
      }),
    ],
  },
  {
    kind: "book-volume",
    label: "Book Volumes",
    cards: [
      card({
        id: "volume-01",
        kind: "book-volume",
        title: "Volume 01",
        subtitle: "Book hierarchy node",
        aspectRatio: "poster",
        cover: asset("Volume 01", ember, burgundy, brass),
        capabilities: [position("volume", 1, "Volume 1"), stats([{ code: "chapters", value: 4 }])],
        meta: [{ icon: "chapter", label: "4 chapters" }],
      }),
    ],
  },
  {
    kind: "book-chapter",
    label: "Book Chapters",
    cards: [
      card({
        id: "chapter-01",
        kind: "book-chapter",
        title: "Chapter 01",
        subtitle: "Reader entry",
        aspectRatio: "poster",
        cover: asset("Chapter 01", forest, burgundy, brass),
        hover: { kind: "image-sequence", assets: sequence("Chapter", [forest, graphite, ember], 5) },
        capabilities: [position("chapter", 1, "Chapter 1"), stats([{ code: "pages", value: 24 }])],
        meta: [{ icon: "book", label: "24 pages" }],
      }),
    ],
  },
  {
    kind: "book-page",
    label: "Book Pages",
    cards: [
      card({
        id: "page-001",
        kind: "book-page",
        title: "Page 001",
        subtitle: "Page entity",
        aspectRatio: "poster",
        cover: asset("Page 001", indigo, ember, brass),
        capabilities: [position("page", 1, "Page 1"), technical({ width: 1200, height: 1800, format: "png" })],
        meta: [{ icon: "image", label: "page 1" }],
      }),
    ],
  },
  {
    kind: "audio-library",
    label: "Audio Libraries",
    cards: [
      card({
        id: "audio-library",
        kind: "audio-library",
        title: "Royalty Free Album",
        subtitle: "Cover-only image role",
        aspectRatio: "square",
        cover: asset("Audio Album", graphite, indigo, brass),
        capabilities: [rating(4), stats([{ code: "tracks", value: 12 }])],
        meta: [{ icon: "audio", label: "12 tracks" }],
      }),
    ],
  },
  {
    kind: "audio-track",
    label: "Audio Tracks",
    cards: [
      card({
        id: "audio-track",
        kind: "audio-track",
        title: "Sample Track",
        subtitle: "Track entity",
        aspectRatio: "square",
        cover: asset("Sample Track", indigo, forest, brass),
        capabilities: [technical({ duration: "00:03:42", codec: "aac" }), position("track", 3, "Track 3")],
        meta: [
          { icon: "duration", label: "03:42" },
          { icon: "audio", label: "track 3" },
        ],
      }),
    ],
  },
  {
    kind: "person",
    label: "People",
    cards: [
      card({
        id: "person-sample",
        kind: "person",
        title: "Sample Person",
        subtitle: "Credit target",
        aspectRatio: "portrait",
        cover: asset("Person", burgundy, indigo, brass),
        capabilities: [stats([{ code: "credits", value: 18 }])],
        meta: [{ icon: "person", label: "18 credits" }],
      }),
    ],
  },
  {
    kind: "studio",
    label: "Studios",
    cards: [
      card({
        id: "studio-sample",
        kind: "studio",
        title: "Sample Studio",
        subtitle: "Producer entity",
        aspectRatio: "wide",
        cover: asset("Studio", graphite, forest, brass),
        capabilities: [stats([{ code: "items", value: 64 }])],
        meta: [{ icon: "studio", label: "64 items" }],
      }),
    ],
  },
  {
    kind: "tag",
    label: "Tags",
    cards: [
      card({
        id: "tag-sample",
        kind: "tag",
        title: "Animation",
        subtitle: "Reusable taxonomy",
        aspectRatio: "square",
        cover: asset("Tag", ember, indigo, brass),
        capabilities: [stats([{ code: "items", value: 31 }])],
        meta: [{ icon: "tag", label: "31 items" }],
      }),
    ],
  },
  {
    kind: "collection",
    label: "Collections",
    cards: [
      card({
        id: "collection-sample",
        kind: "collection",
        title: "Safe Samples",
        subtitle: "Mixed entity set",
        aspectRatio: "video",
        cover: asset("Collection", forest, ember, brass),
        hover: { kind: "image-sequence", assets: sequence("Collection", [forest, burgundy, indigo], 4) },
        capabilities: [stats([{ code: "items", value: 15 }])],
        meta: [{ icon: "collection", label: "15 items" }],
      }),
      card({
        id: "collection-flagged",
        kind: "collection",
        title: "Flag State Sample",
        subtitle: "Synthetic chip coverage",
        aspectRatio: "video",
        cover: asset("Flagged State", burgundy, graphite, brass),
        flagOptions: { isNsfw: true },
        capabilities: [rating(2), stats([{ code: "items", value: 4 }])],
        meta: [{ icon: "collection", label: "4 items" }],
      }),
    ],
  },
];
