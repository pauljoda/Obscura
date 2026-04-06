import type { GalleryListItemDto } from "@obscura/contracts";
import { GalleryEntityCard } from "./galleries/gallery-entity-card";
import { galleryListItemToCardData } from "./galleries/gallery-card-data";

interface GalleryListItemProps {
  gallery: GalleryListItemDto;
}

export function GalleryListItem({ gallery }: GalleryListItemProps) {
  return <GalleryEntityCard gallery={galleryListItemToCardData(gallery)} variant="list" />;
}
