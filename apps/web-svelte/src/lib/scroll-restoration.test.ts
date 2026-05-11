import { describe, expect, it } from "vitest";
import { createPreviousPageScrollRestorer } from "./scroll-restoration";

describe("createPreviousPageScrollRestorer", () => {
  it("restores the previous page scroll position on back navigation once", () => {
    const restorer = createPreviousPageScrollRestorer();

    restorer.captureBeforeNavigation({
      fromHref: "/galleries?view=grid",
      navigationType: "link",
      position: { top: 840, left: 0 },
    });

    expect(
      restorer.restoreAfterNavigation({
        toHref: "/galleries?view=grid",
        navigationType: "popstate",
      }),
    ).toEqual({ top: 840, left: 0 });

    expect(
      restorer.restoreAfterNavigation({
        toHref: "/galleries?view=grid",
        navigationType: "popstate",
      }),
    ).toBeNull();
  });

  it("does not let popstate navigation overwrite the saved previous page", () => {
    const restorer = createPreviousPageScrollRestorer();

    restorer.captureBeforeNavigation({
      fromHref: "/images?comic=false",
      navigationType: "goto",
      position: { top: 1200, left: 0 },
    });
    restorer.captureBeforeNavigation({
      fromHref: "/images/image-1",
      navigationType: "popstate",
      position: { top: 0, left: 0 },
    });

    expect(
      restorer.restoreAfterNavigation({
        toHref: "/images?comic=false",
        navigationType: "popstate",
      }),
    ).toEqual({ top: 1200, left: 0 });
  });

  it("resets scroll on normal navigation between different paths", () => {
    const restorer = createPreviousPageScrollRestorer();

    expect(
      restorer.shouldResetAfterNavigation({
        fromPathname: "/galleries",
        toPathname: "/galleries/gallery-1",
        navigationType: "link",
      }),
    ).toBe(true);

    expect(
      restorer.shouldResetAfterNavigation({
        fromPathname: "/galleries",
        toPathname: "/galleries",
        navigationType: "goto",
      }),
    ).toBe(false);

    expect(
      restorer.shouldResetAfterNavigation({
        fromPathname: "/galleries/gallery-1",
        toPathname: "/galleries",
        navigationType: "popstate",
      }),
    ).toBe(false);
  });
});
