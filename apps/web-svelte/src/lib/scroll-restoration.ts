export type AppNavigationType = "enter" | "form" | "goto" | "leave" | "link" | "popstate";

export interface ScrollPosition {
  top: number;
  left: number;
}

interface CaptureNavigationInput {
  fromHref: string | null | undefined;
  navigationType: AppNavigationType;
  position: ScrollPosition;
}

interface RestoreNavigationInput {
  toHref: string | null | undefined;
  navigationType: AppNavigationType;
}

interface ResetNavigationInput {
  fromPathname: string | null | undefined;
  toPathname: string | null | undefined;
  navigationType: AppNavigationType;
}

export function createPreviousPageScrollRestorer() {
  let previousPage: { href: string; position: ScrollPosition } | null = null;

  return {
    captureBeforeNavigation({ fromHref, navigationType, position }: CaptureNavigationInput) {
      if (!fromHref || navigationType === "popstate") return;
      previousPage = { href: fromHref, position };
    },

    restoreAfterNavigation({ toHref, navigationType }: RestoreNavigationInput): ScrollPosition | null {
      if (!toHref || navigationType !== "popstate" || previousPage?.href !== toHref) return null;
      const position = previousPage.position;
      previousPage = null;
      return position;
    },

    shouldResetAfterNavigation({
      fromPathname,
      toPathname,
      navigationType,
    }: ResetNavigationInput): boolean {
      if (!fromPathname || !toPathname || navigationType === "popstate") return false;
      return fromPathname !== toPathname;
    },
  };
}
