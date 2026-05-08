import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  comicGallerySql,
  isComicGalleryRow,
  isComicSeriesGalleryRow,
} from "./gallery-comics";

describe("comic gallery classification", () => {
  it("treats zip/cbz archive galleries as comics", () => {
    expect(isComicGalleryRow({ galleryType: "zip", zipFilePath: "/comics/One Shot.cbz" })).toBe(true);
    expect(isComicGalleryRow({ galleryType: "zip", zipFilePath: "/comics/One Shot.zip" })).toBe(true);
    expect(isComicGalleryRow({ galleryType: "folder", zipFilePath: null })).toBe(false);
  });

  it("treats an image-empty parent as comic only when every child is a comic archive", () => {
    expect(
      isComicSeriesGalleryRow(
        { galleryType: "folder", zipFilePath: null, imageCount: 0 },
        [
          { galleryType: "zip", zipFilePath: "/comics/Series/Series 1.cbz" },
          { galleryType: "zip", zipFilePath: "/comics/Series/Series 2.zip" },
        ],
      ),
    ).toBe(true);

    expect(
      isComicSeriesGalleryRow(
        { galleryType: "folder", zipFilePath: null, imageCount: 0 },
        [
          { galleryType: "zip", zipFilePath: "/comics/Mixed/Mixed 1.cbz" },
          { galleryType: "folder", zipFilePath: null },
        ],
      ),
    ).toBe(false);

    expect(
      isComicSeriesGalleryRow(
        { galleryType: "folder", zipFilePath: null, imageCount: 3 },
        [{ galleryType: "zip", zipFilePath: "/comics/Mixed/Mixed 1.cbz" }],
      ),
    ).toBe(false);
  });

  it("requires comic series filter matches to have no direct images and no non-comic children", () => {
    const query = new PgDialect().sqlToQuery(comicGallerySql()).sql;

    expect(query).toContain("image_count");
    expect(query).toContain("not exists");
    expect(query).toContain("non_comic_child");
  });
});
