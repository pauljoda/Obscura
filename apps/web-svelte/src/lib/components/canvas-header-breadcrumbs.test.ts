import { describe, expect, it } from "vitest";
import { getCanvasHeaderBreadcrumbItems } from "./canvas-header-breadcrumbs";

describe("getCanvasHeaderBreadcrumbItems", () => {
  it("keeps short breadcrumb trails inline", () => {
    expect(
      getCanvasHeaderBreadcrumbItems([
        { label: "Videos", href: "/videos", isLast: false },
        { label: "Episode 1", href: "#", isLast: true },
      ]),
    ).toEqual([
      { kind: "crumb", label: "Videos", href: "/videos", isLast: false },
      { kind: "crumb", label: "Episode 1", href: "#", isLast: true },
    ]);
  });

  it("collapses previous linked levels behind an overflow item", () => {
    expect(
      getCanvasHeaderBreadcrumbItems([
        { label: "Videos", href: "/videos", isLast: false },
        { label: "Series", href: "/series?series=s1", isLast: false },
        { label: "Season 1", href: "/series?series=s1&season=1", isLast: false },
        { label: "Episode 1", href: "#", isLast: true },
      ]),
    ).toEqual([
      {
        kind: "overflow",
        label: "More breadcrumbs",
        separatorAfter: false,
        items: [
          { label: "Videos", href: "/videos", isLast: false },
          { label: "Series", href: "/series?series=s1", isLast: false },
          { label: "Season 1", href: "/series?series=s1&season=1", isLast: false },
        ],
      },
      { kind: "crumb", label: "Episode 1", href: "#", isLast: true },
    ]);
  });

  it("does not include unlinked crumbs in the overflow menu", () => {
    expect(
      getCanvasHeaderBreadcrumbItems([
        { label: "Images", href: "/images", isLast: false },
        { label: "Gallery", href: "#", isLast: true },
      ]),
    ).toEqual([
      { kind: "crumb", label: "Images", href: "/images", isLast: false },
      { kind: "crumb", label: "Gallery", href: "#", isLast: true },
    ]);
  });
});
