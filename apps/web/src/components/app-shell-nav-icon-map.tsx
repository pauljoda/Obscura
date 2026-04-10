import type { ComponentType } from "react";
import {
  Activity,
  Building2,
  Film,
  FolderOpen,
  Image,
  Images,
  LayoutDashboard,
  Music,
  ScanSearch,
  Search,
  Settings,
  Tags,
  Users,
} from "lucide-react";

/** Lucide components for `appShellSections` item `icon` keys. */
export const appShellNavIconMap: Record<string, ComponentType<{ className?: string }>> = {
  "layout-dashboard": LayoutDashboard,
  film: Film,
  images: Images,
  image: Image,
  music: Music,
  users: Users,
  building: Building2,
  tags: Tags,
  folder: FolderOpen,
  "scan-search": ScanSearch,
  activity: Activity,
  settings: Settings,
  search: Search,
};
