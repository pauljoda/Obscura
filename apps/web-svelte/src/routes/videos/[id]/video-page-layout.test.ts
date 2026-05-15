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
  it("keeps outer padding owned by the shared layout", () => {
    const layoutSource = readLocalSource("../../+layout.svelte");

    expect(layoutSource).toContain('<div class="flex-1 p-5">');
    expect(layoutSource).not.toContain("isVideoDetailPage");
    expect(layoutSource).not.toContain("p-0");
  });

  it("does not add component padding or width constraints around the player", () => {
    const pageSource = readLocalSource("./+page.svelte");
    const detailPageRule = readDetailPageCssRule(pageSource);

    expect(detailPageRule).toContain("padding: 0;");
    expect(detailPageRule).toContain("max-width: none;");
    expect(detailPageRule).toContain("margin: 0;");
  });

  it("opens the transcript sidecar whenever captions are enabled", () => {
    const pageSource = readLocalSource("./+page.svelte");

    expect(pageSource).toContain("if (id) userWantsDock = true;");
    expect(pageSource).toContain('if (id) window.localStorage.setItem("obscura:transcript-docked", "1");');
  });
});
