# Design Language

## Direction

Obscura uses a `Dark Control Room` visual system.

This is not a generic admin dashboard and not a neon cyberpunk cliché. The tone should feel like a private, expensive local console: low light, dense information, careful hierarchy, and controlled contrast.

## Core Principles

- Surfaces feel architectural, not decorative.
- Accent color is rare and meaningful.
- Typography should separate editorial hierarchy from operational data.
- Browsing views should feel calm even when they are information-dense.
- Mobile layouts must preserve control, not collapse into oversized empty cards.

## Palette

- Background: near-black graphite
- Elevated surfaces: deep slate
- Text: warm off-white
- Muted text: cool gray-blue
- Accent: burnished brass
- Error/warning: muted, not saturated

## Typography

- Heading voice: compact, expressive, slightly editorial
- Body voice: clean and neutral
- Utility voice: restrained monospace for queue state, metadata, and diagnostics

Avoid default-feeling typography stacks as the product matures. The current scaffold uses practical defaults only until project fonts are introduced intentionally.

## Components

The first visual primitives should include:

- application shell
- command/search bar
- media card
- queue status panel
- metadata diff/apply panel
- mobile action bar

## Motion

- Motion should communicate state transitions and focus.
- Use a few deliberate transitions instead of constant ambient animation.
- Page and panel reveals should feel weighted and precise.

## Anti-Patterns

- No purple-gradient startup aesthetic.
- No generic SaaS cards with interchangeable spacing and shadows.
- No default shadcn appearance shipped without token and composition changes.
- No hover-only primary actions.

