export const designTokens = {
  background: "#08090c",
  elevated: "#11151c",
  text: "#f5f2ea",
  muted: "#a4acb9",
  accent: "burnished brass"
} as const;

export const apiRoutes = {
  health: "/health",
  jobs: "/jobs"
} as const;

export const appShellSections = [
  {
    kicker: "Browse",
    title: "Library Views",
    description: "Fast grid and list surfaces with room for saved filters, density control, and mobile-first navigation."
  },
  {
    kicker: "Resolve",
    title: "Metadata Queue",
    description: "Dedicated workflows for unmatched files, imported stash records, and low-confidence provider matches."
  },
  {
    kicker: "Operate",
    title: "Job Console",
    description: "Persistent worker topology for scan, probe, fingerprint, preview, and metadata tasks."
  }
] as const;

