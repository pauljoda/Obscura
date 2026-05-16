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

  it("uses app-shell breadcrumbs instead of a page-local back link", () => {
    const pageSource = readLocalSource("./+page.svelte");

    expect(pageSource).toContain("appChrome.setBreadcrumbs");
    expect(pageSource).toContain('{ label: "Videos", href: "/videos" }');
    expect(pageSource).not.toContain('class="back-link"');
    expect(pageSource).not.toContain('<a href="/videos"');
  });

  it("keeps caption selection separate from transcript sidecar docking", () => {
    const pageSource = readLocalSource("./+page.svelte");

    expect(pageSource).toContain("onTranscriptSidecarToggle={toggleTranscriptDock}");
    expect(pageSource).not.toContain("if (id) userWantsDock = true;");
    expect(pageSource).not.toContain('if (id) window.localStorage.setItem("obscura:transcript-docked", "1");');
  });

  it("uses shared thumbnails for the cast and crew rows", () => {
    const pageSource = readLocalSource("./+page.svelte");

    expect(pageSource).toContain("Cast and Crew");
    expect(pageSource).toContain('titleAlign="center"');
    expect(pageSource).toContain('titleSize="compact"');
    expect(pageSource).toContain("{#snippet subtitleContent(card)}");
    expect(pageSource).toContain("credit-scroller");
    expect(pageSource).not.toContain("credit-chip");
  });

  it("renders character credit subtitles without adding a label prefix", () => {
    const pageSource = readLocalSource("./+page.svelte");

    expect(pageSource).toContain("if (character) return character;");
    expect(pageSource).not.toContain("Character ${character}");
  });

  it("adds old video panels through shared EntityDetail section-driven tabs", () => {
    const pageSource = readLocalSource("./+page.svelte");

    expect(pageSource).toContain("VideoMarkerEditor");
    expect(pageSource).toContain("detailSections");
    expect(pageSource).toContain("detailTabs");
    expect(pageSource).toContain("sections: [");
    expect(pageSource).toContain("tabs={detailTabs}");
    expect(pageSource).toContain("sections={detailSections}");
    expect(pageSource).toContain('id: "details"');
    expect(pageSource).toContain('id: "metadata"');
    expect(pageSource).toContain('id: "markers"');
    expect(pageSource).toContain('id: "transcript"');
    expect(pageSource).toContain('id: "files"');
    expect(pageSource).toContain("icon:");
    expect(pageSource).toContain("{#snippet sectionContent(section)}");
    expect(pageSource).toContain("<VideoTranscriptPanel");
    expect(pageSource).toContain("<VideoMarkerEditor");
    expect(pageSource).toContain("markers={card.markers}");
    expect(pageSource).toContain("entityId={videoId}");
    expect(pageSource).toContain('layout: "grid"');
    expect(pageSource).toContain('sections: ["files"]');
  });
});
