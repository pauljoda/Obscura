import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const THUMBNAIL_COMPONENTS = [
  "AudioLibraryThumbnail",
  "AudioTrackThumbnail",
  "CollectionThumbnail",
  "GalleryThumbnail",
  "ImageThumbnail",
  "PerformerThumbnail",
  "SeriesThumbnail",
  "StudioThumbnail",
  "TagThumbnail",
  "VideoThumbnail",
];

describe("central thumbnail imports", () => {
  it("keeps concrete thumbnail components private to the thumbnails module", () => {
    const root = process.cwd();
    const sourceRoot = join(root, "src");
    const files = listSourceFiles(sourceRoot);

    const offenders = files.flatMap((file) => {
      const text = readFileSync(join(sourceRoot, file), "utf8");
      return THUMBNAIL_COMPONENTS.flatMap((name) => {
        const patterns = [
          `$lib/components/thumbnails/${name}.svelte`,
          `./thumbnails/${name}.svelte`,
          `../thumbnails/${name}.svelte`,
          `../../components/thumbnails/${name}.svelte`,
        ];
        return patterns.some((pattern) => text.includes(pattern))
          ? [`${relative(root, join(sourceRoot, file))} imports ${name}`]
          : [];
      });
    });

    expect(offenders).toEqual([]);
  });
});

function listSourceFiles(root: string, dir = root): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) return listSourceFiles(root, fullPath);
    if (!entry.endsWith(".svelte") && !entry.endsWith(".ts")) return [];

    const rel = relative(root, fullPath);
    if (rel.startsWith("lib/components/thumbnails/")) return [];
    if (rel.endsWith(".test.ts") || rel.endsWith(".test-harness.svelte")) return [];
    return [rel];
  });
}
