export const appShellSections = [
  {
    id: "overview",
    kicker: "Overview",
    items: [
      { label: "Dashboard", href: "/", icon: "layout-dashboard" },
      { label: "Search", href: "/search", icon: "search" },
    ],
  },
  {
    id: "browse",
    kicker: "Browse",
    items: [
      { label: "Videos", href: "/scenes", icon: "film" },
      { label: "Galleries", href: "/galleries", icon: "images" },
      { label: "Images", href: "/images", icon: "image" },
      { label: "Actors", href: "/performers", icon: "users" },
      { label: "Studios", href: "/studios", icon: "building" },
      { label: "Tags", href: "/tags", icon: "tags" },
      { label: "Collections", href: "/collections", icon: "folder" },
    ],
  },
  {
    id: "operate",
    kicker: "Operate",
    items: [
      { label: "Identify", href: "/identify", icon: "scan-search" },
      { label: "Jobs", href: "/jobs", icon: "activity" },
      { label: "Settings", href: "/settings", icon: "settings" },
    ],
  },
] as const;

export type NavSection = (typeof appShellSections)[number];
export type NavItem = NavSection["items"][number];
