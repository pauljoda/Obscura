// Design tokens
export { colors } from "./tokens/colors";
export { typography } from "./tokens/typography";
export { animation } from "./tokens/animation";
export { spacing, radii } from "./tokens/spacing";

// Utilities
export { cn } from "./lib/utils";
export {
  type TrickplayFrame,
  parseTrickplayVtt,
  loadTrickplayFrames,
  findFrameAtTime,
} from "./lib/trickplay";

// Primitives
export { Button, type ButtonProps } from "./primitives/button";
export { Badge, type BadgeProps } from "./primitives/badge";

// Composed components
export { StatusLed, type LedStatus, type LedSize } from "./composed/status-led";
export { Meter } from "./composed/meter";
export { Panel } from "./composed/panel";
export { MediaCard, type MediaCardProps } from "./composed/media-card";

// Navigation sections for the app shell sidebar
export const appShellSections = [
  {
    id: "overview",
    kicker: "Overview",
    items: [
      { label: "Dashboard", href: "/", icon: "layout-dashboard" },
    ],
  },
  {
    id: "browse",
    kicker: "Browse",
    items: [
      { label: "Scenes", href: "/scenes", icon: "film" },
      { label: "Galleries", href: "/galleries", icon: "images" },
      { label: "Performers", href: "/performers", icon: "users" },
      { label: "Studios", href: "/studios", icon: "building" },
      { label: "Tags", href: "/tags", icon: "tags" },
      { label: "Collections", href: "/collections", icon: "folder" },
    ],
  },
  {
    id: "operate",
    kicker: "Operate",
    items: [
      { label: "Scrape", href: "/scrape", icon: "scan-search" },
      { label: "Jobs", href: "/jobs", icon: "activity" },
      { label: "Settings", href: "/settings", icon: "settings" },
    ],
  },
] as const;

export type NavSection = (typeof appShellSections)[number];
export type NavItem = NavSection["items"][number];
