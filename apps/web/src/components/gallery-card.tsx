import type { GalleryListItemDto } from "@obscura/contracts";
import { GalleryEntityCard } from "./galleries/gallery-entity-card";
import { galleryListItemToCardData } from "./galleries/gallery-card-data";

interface GalleryCardProps {
  gallery: GalleryListItemDto;
  from?: string;
}

export function GalleryCard({ gallery, from }: GalleryCardProps) {
  return <GalleryEntityCard gallery={galleryListItemToCardData(gallery, from)} />;
}
