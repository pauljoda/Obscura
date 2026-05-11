export interface CanvasHeaderBreadcrumb {
  label: string;
  href: string;
  isLast: boolean;
}

export type CanvasHeaderBreadcrumbItem =
  | ({ kind: "crumb" } & CanvasHeaderBreadcrumb)
  | {
      kind: "overflow";
      label: string;
      items: CanvasHeaderBreadcrumb[];
    };

export function getCanvasHeaderBreadcrumbItems(
  crumbs: CanvasHeaderBreadcrumb[],
): CanvasHeaderBreadcrumbItem[] {
  if (crumbs.length <= 2) {
    return crumbs.map((crumb) => ({ kind: "crumb", ...crumb }));
  }

  const current = crumbs.at(-1);
  const previousLinks = crumbs.slice(0, -1).filter((crumb) => !crumb.isLast && crumb.href !== "#");

  if (!current || previousLinks.length < 2) {
    return crumbs.map((crumb) => ({ kind: "crumb", ...crumb }));
  }

  return [
    {
      kind: "overflow",
      label: "More breadcrumbs",
      items: previousLinks,
    },
    { kind: "crumb", ...current },
  ];
}
