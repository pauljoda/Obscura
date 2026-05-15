export interface EntityRouteContext {
  kind: string;
  id: string;
}

interface EntityRouteRule {
  kind: string;
  topLevel: boolean;
  resolve(id: string, parent?: EntityRouteContext): string;
  browsePath: string;
}

const ROUTE_RULES: EntityRouteRule[] = [
  { kind: "video", topLevel: true, browsePath: "/videos", resolve: (id) => `/videos/${id}` },
  { kind: "video-series", topLevel: true, browsePath: "/series", resolve: (id) => `/series/${id}` },
  { kind: "video-season", topLevel: false, browsePath: "/series", resolve: (id, p) => `/series/${p!.id}/seasons/${id}` },
  { kind: "gallery", topLevel: true, browsePath: "/galleries", resolve: (id) => `/galleries/${id}` },
  { kind: "book", topLevel: true, browsePath: "/books", resolve: (id) => `/books/${id}` },
  { kind: "book-volume", topLevel: false, browsePath: "/books", resolve: (id, p) => `/books/${p!.id}/volumes/${id}` },
  { kind: "book-chapter", topLevel: false, browsePath: "/books", resolve: (id, p) => `/books/${p!.id}/chapters/${id}` },
  { kind: "image", topLevel: true, browsePath: "/images", resolve: (id) => `/images/${id}` },
  { kind: "audio-library", topLevel: true, browsePath: "/audio", resolve: (id) => `/audio/${id}` },
  { kind: "audio-track", topLevel: false, browsePath: "/audio", resolve: (id, p) => `/audio/${p!.id}/tracks/${id}` },
  { kind: "person", topLevel: true, browsePath: "/performers", resolve: (id) => `/performers/${id}` },
  { kind: "studio", topLevel: true, browsePath: "/studios", resolve: (id) => `/studios/${id}` },
  { kind: "tag", topLevel: true, browsePath: "/tags", resolve: (id) => `/tags/${id}` },
  { kind: "collection", topLevel: true, browsePath: "/collections", resolve: (id) => `/collections/${id}` },
];

const ruleMap = new Map(ROUTE_RULES.map((r) => [r.kind, r]));

export function resolveEntityHref(
  kind: string,
  id: string,
  parent?: EntityRouteContext,
): string | undefined {
  const rule = ruleMap.get(kind);
  if (!rule) return undefined;
  if (!rule.topLevel && !parent) return undefined;
  return rule.resolve(id, parent);
}

export function resolveEntityBrowsePath(kind: string): string | undefined {
  return ruleMap.get(kind)?.browsePath;
}

export function isTopLevelEntity(kind: string): boolean {
  return ruleMap.get(kind)?.topLevel ?? false;
}
