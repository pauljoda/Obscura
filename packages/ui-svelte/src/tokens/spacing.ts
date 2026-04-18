export const spacing = {
  panel: "1rem",
  panelLg: "1.25rem",
  card: "0.75rem",
  gutter: "1rem",
} as const;

export const radii = {
  xs: "2px",
  sm: "4px",
  md: "8px",
  lg: "12px",
  xl: "16px",
  full: "9999px",
} as const;

export type Spacing = typeof spacing;
export type Radii = typeof radii;
