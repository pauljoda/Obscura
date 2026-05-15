import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readLocalSource(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

function readDetailPageCssRule(source: string) {
  const match = source.match(/\.detail-page\s*\{(?<body>[\s\S]*?)\n\s*\}/);
  if (!match?.groups?.body) throw new Error("Could not find .detail-page CSS rule");
  return match.groups.body;
}

describe("/videos/[id] detail layout", () => {
  it("opts the video detail route out of shell padding", () => {
    const layoutSource = readLocalSource("../../+layout.svelte");

    expect(layoutSource).toContain("isVideoDetailPage");
    expect(layoutSource).toMatch(/isVideoDetailPage\s*\?\s*"p-0"\s*:\s*"p-5"/);
  });

  it("does not add component padding or width constraints around the player", () => {
    const pageSource = readLocalSource("./+page.svelte");
    const detailPageRule = readDetailPageCssRule(pageSource);

    expect(detailPageRule).toContain("padding: 0;");
    expect(detailPageRule).toContain("max-width: none;");
    expect(detailPageRule).toContain("margin: 0;");
  });
});
