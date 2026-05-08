import { sql, type SQL } from "drizzle-orm";
import { schema } from "@obscura/db";

const { galleries } = schema;

export type ComicGalleryRow = {
  galleryType: string;
  zipFilePath?: string | null;
};

export type ComicSeriesGalleryRow = ComicGalleryRow & {
  imageCount?: number | null;
};

export function isComicGalleryRow(gallery: ComicGalleryRow) {
  if (gallery.galleryType !== "zip") return false;
  const lowerPath = (gallery.zipFilePath ?? "").toLowerCase();
  return lowerPath.endsWith(".zip") || lowerPath.endsWith(".cbz");
}

export function isComicSeriesGalleryRow(
  gallery: ComicSeriesGalleryRow,
  children: ComicGalleryRow[],
) {
  return (
    !isComicGalleryRow(gallery) &&
    (gallery.imageCount ?? 0) === 0 &&
    children.length > 0 &&
    children.every((child) => isComicGalleryRow(child))
  );
}

export function comicArchivePathSql(column: typeof galleries.zipFilePath): SQL {
  return sql`(lower(coalesce(${column}, '')) like '%.zip' or lower(coalesce(${column}, '')) like '%.cbz')`;
}

export function comicGallerySql(): SQL {
  return sql`(
    (${galleries.galleryType} = 'zip' and ${comicArchivePathSql(galleries.zipFilePath)})
    or (
      coalesce(${galleries.imageCount}, 0) = 0
      and exists (
        select 1
        from galleries comic_child
        where comic_child.parent_id = ${galleries.id}
      )
      and not exists (
        select 1
        from galleries non_comic_child
        where non_comic_child.parent_id = ${galleries.id}
          and not (
            non_comic_child.gallery_type = 'zip'
            and (
              lower(coalesce(non_comic_child.zip_file_path, '')) like '%.zip'
              or lower(coalesce(non_comic_child.zip_file_path, '')) like '%.cbz'
            )
          )
      )
    )
  )`;
}
