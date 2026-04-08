import type { EntityKind } from "@obscura/contracts";
import {
  Building2,
  Film,
  Image,
  Images,
  Tag,
  Users,
  type LucideIcon,
} from "lucide-react";

export const ALL_SEARCH_KINDS: EntityKind[] = [
  "scene",
  "performer",
  "studio",
  "tag",
  "gallery",
  "image",
];

interface SearchKindConfig {
  label: string;
  icon: LucideIcon;
  href: string;
}

export const SEARCH_KIND_CONFIG: Record<EntityKind, SearchKindConfig> = {
  scene: { label: "Videos", icon: Film, href: "/scenes" },
  performer: { label: "Actors", icon: Users, href: "/performers" },
  studio: { label: "Studios", icon: Building2, href: "/studios" },
  tag: { label: "Tags", icon: Tag, href: "/tags" },
  gallery: { label: "Galleries", icon: Images, href: "/galleries" },
  image: { label: "Images", icon: Image, href: "/images" },
};
