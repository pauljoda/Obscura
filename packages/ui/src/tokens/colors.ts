export const colors = {
  bg: "#08090c",
  surface: {
    1: "#0d1017",
    2: "#11151c",
    3: "#181d27",
    4: "#1f2533",
  },
  text: {
    primary: "#f5f2ea",
    secondary: "#c8ccd4",
    muted: "#a4acb9",
    disabled: "#5a6070",
    accent: "#c79b5c",
    accentBright: "#ddb477",
  },
  accent: {
    950: "#1a1408",
    900: "#2d2210",
    800: "#4a3818",
    700: "#6b5225",
    600: "#8c6c32",
    500: "#c79b5c",
    400: "#d4af74",
    300: "#ddb477",
    200: "#e8cfa0",
    100: "#f3e6cc",
    50: "#faf4e8",
  },
  status: {
    success: { default: "#5a9670", muted: "#3d6b4f", text: "#8fbfa1" },
    warning: { default: "#b89545", muted: "#6b5a2d", text: "#d4b76a" },
    error: { default: "#b34f56", muted: "#6b3338", text: "#d47a80" },
    info: { default: "#4a80b3", muted: "#2d4a6b", text: "#7aaad4" },
  },
  border: {
    subtle: "rgba(164, 172, 185, 0.06)",
    default: "rgba(164, 172, 185, 0.12)",
    accent: "rgba(199, 155, 92, 0.24)",
    accentStrong: "rgba(199, 155, 92, 0.45)",
  },
  overlay: {
    scrim: "rgba(8, 9, 12, 0.75)",
    heavy: "rgba(8, 9, 12, 0.9)",
    glass: "rgba(17, 21, 28, 0.8)",
  },
} as const;

export type Colors = typeof colors;
