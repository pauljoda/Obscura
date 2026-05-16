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

  it("uses the shared no-image detail hero because the video player is the media preview", () => {
    const pageSource = readLocalSource("./+page.svelte");

    expect(pageSource).toContain("showHero={false}");
    expect(pageSource).toContain('posterSize="none"');
  });

  it("keeps caption selection separate from transcript sidecar docking", () => {
    const pageSource = readLocalSource("./+page.svelte");

    expect(pageSource).toContain("onTranscriptSidecarToggle={toggleTranscriptDock}");
    expect(pageSource).not.toContain("if (id) userWantsDock = true;");
    expect(pageSource).not.toContain('if (id) window.localStorage.setItem("obscura:transcript-docked", "1");');
  });
});
