export const animation = {
  easing: {
    default: "cubic-bezier(0.4, 0, 0.2, 1)",
    enter: "cubic-bezier(0, 0, 0.2, 1)",
    exit: "cubic-bezier(0.4, 0, 1, 1)",
    mechanical: "cubic-bezier(0.25, 0, 0.25, 1)",
  },
  duration: {
    fast: "100ms",
    normal: "180ms",
    moderate: "250ms",
    slow: "400ms",
  },
} as const;

export type Animation = typeof animation;
