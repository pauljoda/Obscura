export const colors = {
  bg: "#07080b",
  surface: {
    1: "#0c0f15",
    2: "#101420",
    3: "#151a28",
    4: "#1c2235",
  },
  glass: {
    1: "rgba(12, 15, 21, 0.72)",
    2: "rgba(16, 20, 32, 0.82)",
    3: "rgba(21, 26, 40, 0.92)",
  },
  glassBlur: {
    1: "12px",
    2: "16px",
    3: "24px",
  },
  text: {
    primary: "#f2eed8",
    secondary: "#c4c9d4",
    muted: "#8a93a6",
    disabled: "#4a5260",
    accent: "#c49a5a",
  },
  accent: {
    950: "#131008",
    900: "#261f0f",
    800: "#3d3016",
    700: "#5a4620",
    600: "#7a5e2c",
    500: "#c49a5a",
    400: "#d4af74",
    300: "#e0c48e",
    200: "#ebdaaf",
    100: "#f5efd5",
    50: "#faf6ea",
  },
  accentGradient: {
    selection: "linear-gradient(135deg, #c49a5a 0%, #e0c48e 100%)",
    active: "linear-gradient(135deg, #7a5e2c 0%, #c49a5a 100%)",
    subtle: "linear-gradient(180deg, rgba(196,154,90,0.12) 0%, rgba(196,154,90,0) 100%)",
  },
  glow: {
    subtle: "0 0 0 1px rgba(196,154,90,0.35), 0 0 8px rgba(196,154,90,0.15)",
    full: "0 0 0 1px rgba(196,154,90,0.60), 0 0 16px rgba(196,154,90,0.30), 0 0 32px rgba(196,154,90,0.10)",
  },
  status: {
    success: { default: "#4e8a62", muted: "#2a4a38", text: "#80b898", glow: "rgba(78, 138, 98, 0.30)" },
    warning: { default: "#b09040", muted: "#5c4c20", text: "#ccb060", glow: "rgba(176, 144, 64, 0.30)" },
    error:   { default: "#a84850", muted: "#5a2c30", text: "#cc7880", glow: "rgba(168, 72, 80, 0.30)" },
    info:    { default: "#4478a8", muted: "#283850", text: "#70a4cc", glow: "rgba(68, 120, 168, 0.30)" },
  },
  border: {
    subtle: "rgba(148, 158, 178, 0.07)",
    default: "rgba(148, 158, 178, 0.13)",
    accent: "rgba(196, 154, 90, 0.25)",
    accentStrong: "rgba(196, 154, 90, 0.50)",
    glow: "rgba(196, 154, 90, 0.80)",
  },
  overlay: {
    scrim: "rgba(7, 8, 11, 0.75)",
    heavy: "rgba(7, 8, 11, 0.92)",
  },
} as const;

export type Colors = typeof colors;
