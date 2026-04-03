# Design Language

## Direction

Obscura uses a `Dark Control Room` visual system.

The tone is a private, expensive local console: Blackmagic DaVinci Resolve meets high-end audio rack gear meets film color grading suites. Low light, dense information, careful hierarchy, and controlled contrast.

## Core Principles

- Surfaces feel architectural, not decorative.
- Every surface is a machined panel — gradient fills with inset bevel highlights.
- Accent color (burnished brass) is rare and meaningful — only on active/selected states.
- Typography separates editorial hierarchy from operational data via three font voices.
- Browsing views should feel calm even when they are information-dense.
- Mobile layouts must preserve control, not collapse into oversized empty cards.

## Palette

### Surface Hierarchy (5 levels)

- `bg` — near-black graphite (#08090c)
- `surface-1` — sidebar, inset wells (#0d1017)
- `surface-2` — cards, panels, content areas (#11151c)
- `surface-3` — elevated panels, popovers (#181d27)
- `surface-4` — dropdowns, tooltips (#1f2533)

### Text

- Primary: warm off-white (#f5f2ea)
- Secondary: light cool gray (#c8ccd4)
- Muted: cool gray-blue (#a4acb9)
- Disabled: dark gray (#5a6070)
- Accent: burnished brass (#c79b5c)

### Accent (Burnished Brass Scale)

10-step scale from `accent-950` (#1a1408) through `accent-50` (#faf4e8). Primary accent is `accent-500` (#c79b5c).

### Status Colors (muted, industrial — like LED indicators)

- Success: #5a9670
- Warning: #b89545
- Error: #b34f56
- Info: #4a80b3

Each has `-muted` (background) and `-text` (readable on dark) variants.

## Typography

Three font voices loaded via `next/font`:

| Voice   | Font              | Usage                                      |
|---------|-------------------|---------------------------------------------|
| Heading | Geist             | Page titles, section headers, card titles   |
| Body    | Inter             | Body text, descriptions, labels             |
| Utility | JetBrains Mono    | Metadata, queue stats, file paths, durations |

Base font size: 14px (dense UI). Kicker text: 0.68rem uppercase with 0.1em tracking.

## Surface Recipes

### Panel (primary container)

Gradient background + inset top-bevel highlight (1px white at 4% opacity) + subtle border + outer shadow. Creates the "machined edge" effect.

### Card (grid items)

Same recipe, tighter border radius (8px). On hover: border transitions to brass, shadow deepens, translateY(-1px).

### Well (inset container)

Darker-than-parent recessed surface with inset shadow. For inputs, code blocks, metadata displays.

### Elevated (floating panels)

Backdrop blur (16px) + heavy shadow. For popovers, command palette, dropdowns.

## Recurring Motifs

### LED Status Indicators

8px circles with radial glow (box-shadow). Colors: green (active), amber (warning), red (error), gray (idle), brass (highlight). Pulse animation for processing state.

### Meter / Progress Bar

3px track with brass gradient fill. Used for job progress, disk usage, queue status.

### Separator

Gradient-fade horizontal rule (transparent at edges, 10% opacity in center). Never a hard border.

## Motion

- All motion is weighted and deliberate — like precision machinery, no bounce.
- Easing: cubic-bezier(0.4, 0, 0.2, 1) for standard transitions.
- Durations: fast (100ms), normal (180ms), moderate (250ms), slow (400ms).
- Sidebar collapse: 250ms mechanical easing.
- Card hover: 180ms border + shadow transition.
- Panel reveals: scale(0.97) + fade entrance.

## Anti-Patterns

- No purple-gradient startup aesthetic.
- No generic SaaS cards with interchangeable spacing and shadows.
- No default shadcn appearance shipped without token and composition changes.
- No hover-only primary actions.
- No bright saturated status colors — always muted, like real equipment LEDs.
