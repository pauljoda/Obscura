import type { GalleryListItemDto } from "@obscura/contracts";
import { GalleryEntityCard } from "./galleries/gallery-entity-card";
import { galleryListItemToCardData } from "./galleries/gallery-card-data";

interface GalleryListItemProps {
  gallery: GalleryListItemDto;
  from?: string;
}

export function GalleryListItem({ gallery, from }: GalleryListItemProps) {
  return <GalleryEntityCard gallery={galleryListItemToCardData(gallery, from)} variant="list" />;
}
