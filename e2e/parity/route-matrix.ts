export type ParityRouteName =
  | "dashboard"
  | "videos"
  | "video-detail"
  | "search"
  | "plugins"
  | "settings"
  | "jobs"
  | "identify";

export type ParityRoutePath =
  | "/"
  | "/videos"
  | "/videos/[fixtureId]"
  | "/search"
  | "/plugins"
  | "/settings"
  | "/jobs"
  | "/identify";

export interface ParityRouteDefinition {
  readonly name: ParityRouteName;
  readonly path: ParityRoutePath;
}

export const parityRoutes = [
  { path: "/", name: "dashboard" },
  { path: "/videos", name: "videos" },
  { path: "/videos/[fixtureId]", name: "video-detail" },
  { path: "/search", name: "search" },
  { path: "/plugins", name: "plugins" },
  { path: "/settings", name: "settings" },
  { path: "/jobs", name: "jobs" },
  { path: "/identify", name: "identify" },
] as const satisfies readonly ParityRouteDefinition[];

export function resolveParityRoutePath(
  route: ParityRouteDefinition,
  fixtureId: string,
): string {
  if (route.path === "/videos/[fixtureId]") {
    return `/videos/${fixtureId}`;
  }

  return route.path;
}
