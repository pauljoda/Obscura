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
  { kind: "video", topLevel: true, browsePath: "/v2/videos", resolve: (id) => `/v2/videos/${id}` },
  { kind: "video-series", topLevel: true, browsePath: "/v2/series", resolve: (id) => `/v2/series/${id}` },
  { kind: "video-season", topLevel: false, browsePath: "/v2/series", resolve: (id, p) => `/v2/series/${p!.id}/seasons/${id}` },
  { kind: "gallery", topLevel: true, browsePath: "/v2/galleries", resolve: (id) => `/v2/galleries/${id}` },
  { kind: "book", topLevel: true, browsePath: "/v2/books", resolve: (id) => `/v2/books/${id}` },
  { kind: "book-volume", topLevel: false, browsePath: "/v2/books", resolve: (id, p) => `/v2/books/${p!.id}/volumes/${id}` },
  { kind: "book-chapter", topLevel: false, browsePath: "/v2/books", resolve: (id, p) => `/v2/books/${p!.id}/chapters/${id}` },
  { kind: "image", topLevel: true, browsePath: "/v2/images", resolve: (id) => `/v2/images/${id}` },
  { kind: "audio-library", topLevel: true, browsePath: "/v2/audio", resolve: (id) => `/v2/audio/${id}` },
  { kind: "audio-track", topLevel: false, browsePath: "/v2/audio", resolve: (id, p) => `/v2/audio/${p!.id}/tracks/${id}` },
  { kind: "person", topLevel: true, browsePath: "/v2/performers", resolve: (id) => `/v2/performers/${id}` },
  { kind: "studio", topLevel: true, browsePath: "/v2/studios", resolve: (id) => `/v2/studios/${id}` },
  { kind: "tag", topLevel: true, browsePath: "/v2/tags", resolve: (id) => `/v2/tags/${id}` },
  { kind: "collection", topLevel: true, browsePath: "/v2/collections", resolve: (id) => `/v2/collections/${id}` },
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
