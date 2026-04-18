import type { Component } from "svelte";
import {
  Activity,
  Building2,
  Film,
  FolderOpen,
  Image,
  Images,
  LayoutDashboard,
  Music,
  Puzzle,
  ScanSearch,
  Search,
  Settings,
  Tags,
  Users,
} from "@lucide/svelte";

/** Lucide components keyed by the `icon` slugs used in `appShellSections`. */
export const appShellNavIconMap: Record<string, Component<Record<string, unknown>>> = {
  "layout-dashboard": LayoutDashboard as unknown as Component<Record<string, unknown>>,
  film: Film as unknown as Component<Record<string, unknown>>,
  images: Images as unknown as Component<Record<string, unknown>>,
  image: Image as unknown as Component<Record<string, unknown>>,
  music: Music as unknown as Component<Record<string, unknown>>,
  users: Users as unknown as Component<Record<string, unknown>>,
  building: Building2 as unknown as Component<Record<string, unknown>>,
  tags: Tags as unknown as Component<Record<string, unknown>>,
  folder: FolderOpen as unknown as Component<Record<string, unknown>>,
  "scan-search": ScanSearch as unknown as Component<Record<string, unknown>>,
  puzzle: Puzzle as unknown as Component<Record<string, unknown>>,
  activity: Activity as unknown as Component<Record<string, unknown>>,
  settings: Settings as unknown as Component<Record<string, unknown>>,
  search: Search as unknown as Component<Record<string, unknown>>,
};
