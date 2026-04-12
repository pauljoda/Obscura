"use client";

import { useState, type ReactNode } from "react";
import { Badge, Button, Checkbox, Meter, Panel, StatusLed } from "@obscura/ui";
import { cn } from "@obscura/ui/lib/utils";
import { Loader2, Palette, Save } from "lucide-react";
import { AppRouteLoading } from "../app-route-loading";

function Section({
  description,
  title,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="border-b border-border-subtle px-1 pb-3">
        <h2 className="font-heading text-base font-semibold tracking-wide text-text-primary">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-3xl text-[0.72rem] leading-relaxed text-text-muted">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Swatch({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className={cn("h-12 border border-border-subtle shadow-well", className)} />
      <span className="text-mono-sm text-text-disabled">{label}</span>
    </div>
  );
}

export function DesignLanguageShowcase() {
  const [demoChecked, setDemoChecked] = useState(true);

  return (
    <div className="mx-auto max-w-5xl space-y-12 px-4 py-8 pb-24">
      <header className="space-y-2 border-b border-border-subtle pb-6">
        <p className="text-kicker">Obscura</p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-text-primary">Design language</h1>
        <p className="max-w-2xl text-sm text-text-muted">
          Visual reference for typography, surfaces, status, buttons, and motion. Open this route during UI work to
          verify tokens and components against the Dark Room system (
          <span className="text-mono-sm text-text-accent">/design-language</span>
          ).
        </p>
      </header>

      <Section
        title="Typography"
        description="Three voices: Geist (headings), Inter (body), JetBrains Mono (utility)."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Panel variant="well" className="p-4">
            <p className="text-kicker mb-2">Kicker</p>
            <h3 className="font-heading text-xl font-semibold text-text-primary">Heading — Geist</h3>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              Body default inherits Inter. Use for descriptions and dense UI copy.
            </p>
            <p className="mt-2 font-heading text-sm font-medium text-text-secondary">Heading voice at smaller size</p>
          </Panel>
          <Panel variant="well" className="p-4">
            <p className="text-mono text-text-primary">text-mono — durations, paths, counters</p>
            <p className="mt-2 text-mono-sm text-text-muted">text-mono-sm — compact metadata</p>
            <p className="mt-2 text-mono-tabular text-text-accent">text-mono-tabular 00:12:05</p>
            <p className="mt-2 text-ephemeral">text-ephemeral — transient / secondary timing</p>
            <p className="mt-2 text-glow-accent">text-glow-accent — brass glow emphasis</p>
            <p className="mt-2 text-glow-phosphor">text-glow-phosphor — phosphor highlight</p>
            <p className="mt-2 text-label text-text-muted">Label treatment</p>
          </Panel>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="text-text-primary">text-primary</span>
          <span className="text-text-secondary">text-secondary</span>
          <span className="text-text-muted">text-muted</span>
          <span className="text-text-disabled">text-disabled</span>
          <span className="text-text-accent">text-accent</span>
        </div>
      </Section>

      <Section title="Buttons" description="Shared Button primitive — primary uses brass control-plate styling.">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="primary" size="sm">
            Primary sm
          </Button>
          <Button type="button" variant="primary" size="md">
            Primary md
          </Button>
          <Button type="button" variant="secondary" size="md">
            Secondary
          </Button>
          <Button type="button" variant="ghost" size="md">
            Ghost
          </Button>
          <Button type="button" variant="danger" size="md">
            Danger
          </Button>
          <Button type="button" variant="primary" size="md" disabled>
            Disabled
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="primary" size="md">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-accent-200" />
            Primary + spinner
          </Button>
          <Button type="button" variant="primary" size="md">
            <Save className="h-3.5 w-3.5" />
            With icon
          </Button>
        </div>
        <div>
          <p className="control-label mb-2">Accent utility button</p>
          <button type="button" className="btn-accent px-3 py-2 text-xs font-medium">
            .btn-accent
          </button>
        </div>
      </Section>

      <Section title="Badges & chips" description="Badge variants and tag-style chips from globals.">
        <div className="flex flex-wrap gap-2">
          <Badge variant="default">Default</Badge>
          <Badge variant="accent">Accent</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="error">Error</Badge>
          <Badge variant="info">Info</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="tag-chip tag-chip-default">tag default</span>
          <span className="tag-chip tag-chip-accent">tag accent</span>
          <span className="tag-chip tag-chip-info">tag info</span>
          <span className="tag-chip tag-chip-success">tag success</span>
          <span className="tag-chip tag-chip-warning">tag warning</span>
          <span className="tag-chip tag-chip-error">tag error</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="pill-accent px-2 py-0.5 text-xs">pill-accent</span>
          <span className="pill-muted px-2 py-0.5 text-xs">pill-muted</span>
        </div>
      </Section>

      <Section title="Surfaces & glass" description="Material layers, glass chips, and wells (see globals.css).">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div className="p-4 text-center text-mono-sm text-text-muted bg-bg border border-border-subtle">bg</div>
          <div className="p-4 text-center text-mono-sm text-text-muted bg-surface-1 border border-border-subtle">
            surface-1
          </div>
          <div className="p-4 text-center text-mono-sm text-text-muted bg-surface-2 border border-border-subtle">
            surface-2
          </div>
          <div className="p-4 text-center text-mono-sm text-text-muted bg-surface-3 border border-border-subtle">
            surface-3
          </div>
          <div className="p-4 text-center text-mono-sm text-text-muted bg-surface-4 border border-border-subtle">
            surface-4
          </div>
          <div className="glass-chip p-4 text-center text-mono-sm text-text-secondary">glass-chip</div>
          <div className="glass-chip-accent p-4 text-center text-mono-sm text-accent-200">glass-chip-accent</div>
          <div className="media-chip p-4 text-center text-mono-sm text-text-secondary">media-chip</div>
          <div className="media-chip-accent p-4 text-center text-mono-sm text-accent-200">media-chip-accent</div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Panel variant="panel" className="p-4 text-sm text-text-muted">
            Panel — surface-panel
          </Panel>
          <Panel variant="well" className="p-4 text-sm text-text-muted">
            Well — surface-well
          </Panel>
          <Panel variant="elevated" className="p-4 text-sm text-text-muted">
            Elevated — surface-elevated
          </Panel>
        </div>
        <div className="surface-card no-lift p-4 text-sm text-text-secondary">surface-card (glass)</div>
        <div className="surface-card-sharp no-lift p-4 text-sm text-text-secondary">surface-card-sharp</div>
        <div className="empty-rack-slot p-6 text-center text-sm text-text-muted">empty-rack-slot</div>
      </Section>

      <Section title="Brass accent scale" description="Warm operational accent — use sparingly for active state.">
        <div className="flex flex-wrap gap-2">
          {(
            [
              [50, "bg-accent-50"],
              [100, "bg-accent-100"],
              [200, "bg-accent-200"],
              [300, "bg-accent-300"],
              [400, "bg-accent-400"],
              [500, "bg-accent-500"],
              [600, "bg-accent-600"],
              [700, "bg-accent-700"],
              [800, "bg-accent-800"],
              [900, "bg-accent-900"],
              [950, "bg-accent-950"],
            ] as const
          ).map(([step, bgClass]) => (
            <Swatch key={step} label={String(step)} className={bgClass} />
          ))}
        </div>
      </Section>

      <Section title="Status colors" description="Muted LED-style status palette.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Swatch label="success" className="bg-success" />
          <Swatch label="success-muted" className="bg-success-muted" />
          <Swatch label="warning" className="bg-warning" />
          <Swatch label="warning-muted" className="bg-warning-muted" />
          <Swatch label="error" className="bg-error" />
          <Swatch label="error-muted" className="bg-error-muted" />
          <Swatch label="info" className="bg-info" />
          <Swatch label="info-muted" className="bg-info-muted" />
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="text-success-text">success-text</span>
          <span className="text-warning-text">warning-text</span>
          <span className="text-error-text">error-text</span>
          <span className="text-info-text">info-text</span>
        </div>
      </Section>

      <Section title="Borders & separators" description="Hairline borders and horizontal rules.">
        <div className="flex flex-wrap gap-3">
          <div className="h-16 w-24 border border-border-subtle bg-surface-2 p-2 text-mono-sm text-text-muted">
            subtle
          </div>
          <div className="h-16 w-24 border border-border-default bg-surface-2 p-2 text-mono-sm text-text-muted">
            default
          </div>
          <div className="h-16 w-24 border border-border-accent bg-surface-2 p-2 text-mono-sm text-text-muted">
            accent
          </div>
          <div className="h-16 w-24 border border-border-accent-strong bg-surface-2 p-2 text-mono-sm text-text-muted">
            accent-strong
          </div>
        </div>
        <div className="separator max-w-md" />
      </Section>

      <Section title="LEDs & StatusLed" description="Hardware-style indicators; pulse for activity.">
        <div className="flex flex-wrap items-center gap-6">
          {(
            [
              "active",
              "warning",
              "error",
              "info",
              "idle",
              "accent",
              "phosphor",
            ] as const
          ).map((s) => (
            <div key={s} className="flex flex-col items-center gap-2">
              <StatusLed status={s} />
              <span className="text-mono-sm text-text-disabled">{s}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex flex-col items-center gap-2">
            <StatusLed status="accent" pulse />
            <span className="text-mono-sm text-text-disabled">accent pulse</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="led led-lg led-accent led-pulse" />
            <span className="text-mono-sm text-text-disabled">led-lg led-pulse</span>
          </div>
        </div>
      </Section>

      <Section title="Meters & progress" description="Accent and phosphor meter tracks; video-style progress sample.">
        <div className="grid max-w-xl gap-4">
          <Meter label="Accent meter" value={62} max={100} showValue variant="accent" />
          <Meter label="Phosphor meter" value={38} max={100} showValue variant="phosphor" />
        </div>
        <div className="max-w-xl space-y-2">
          <p className="text-label text-text-muted">video-progress-track</p>
          <div className="video-progress-track">
            <div className="video-progress-buffered" style={{ width: "78%" }} />
            <div className="video-progress-fill" style={{ width: "42%" }} />
          </div>
        </div>
      </Section>

      <Section
        title="Loading states"
        description="Route-level system loading (Next.js app segment), then inline spinners and panel patterns."
      >
        <div className="space-y-2">
          <p className="text-label text-text-muted">System — AppRouteLoading (identical to (app)/loading.tsx)</p>
          <p className="text-[0.65rem] text-text-disabled">
            Shown while a server component route suspends; centered brass spinning square + mono label.
          </p>
          <div className="flex min-h-[220px] flex-col overflow-hidden border border-border-default bg-bg">
            <AppRouteLoading />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-8">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-text-disabled" />
            <span className="text-mono-sm text-text-disabled">Loader2 muted</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-accent-400 drop-shadow-[0_0_10px_rgba(199,155,92,0.35)]" />
            <span className="text-mono-sm text-text-disabled">Loader2 brass</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusLed status="accent" pulse />
            <Loader2 className="h-5 w-5 animate-spin text-accent-300 drop-shadow-[0_0_6px_rgba(199,155,92,0.35)]" />
            <span className="text-mono-sm text-text-muted">LED + spinner</span>
          </div>
        </div>
        <div className="surface-card no-lift flex max-w-md flex-col items-center justify-center gap-3 p-10">
          <div className="flex items-center gap-2">
            <StatusLed status="accent" pulse />
            <Loader2 className="h-6 w-6 animate-spin text-accent-400 drop-shadow-[0_0_8px_rgba(199,155,92,0.3)]" />
          </div>
          <span className="text-mono-sm text-text-muted">Panel loading pattern</span>
        </div>
      </Section>

      <Section title="Motion" description="Glow pulse on selection; use sparingly per design language.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="surface-card no-lift glow-pulse p-6 text-center text-sm text-text-accent">
            .glow-pulse (card)
          </div>
          <div className="flex items-center justify-center gap-3 border border-border-accent bg-accent-950/20 p-6">
            <span className="led led-lg led-warning led-pulse" />
            <span className="text-mono-sm text-warning-text">led-pulse warning</span>
          </div>
        </div>
      </Section>

      <Section title="Form controls" description="Labels, inputs, keyboard hints, checkbox.">
        <div className="grid max-w-lg gap-3">
          <div>
            <label className="control-label" htmlFor="demo-input">
              Control label
            </label>
            <input id="demo-input" className="control-input" placeholder="control-input placeholder" />
          </div>
          <p className="text-sm text-text-muted">
            Shortcut: <kbd className="kbd">⌘K</kbd> <kbd className="kbd">Ctrl+K</kbd>
          </p>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-text-secondary">
            <Checkbox checked={demoChecked} onChange={(e) => setDemoChecked(e.target.checked)} />
            Checkbox (controlled demo)
          </label>
        </div>
      </Section>

      <Section title="Captions (player)" description="Subtitle style plates — three variants in globals.">
        <Panel variant="well" className="p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <p className="video-caption-stylized text-sm">Stylized caption sample</p>
            <p className="video-caption-classic text-sm">Classic caption sample</p>
            <p className="video-caption-outline text-sm">Outline caption sample</p>
          </div>
        </Panel>
      </Section>

      <Section title="Gradient placeholders" description="Thumbnail / card placeholder gradients used in the app.">
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {(
            [
              "gradient-thumb-1",
              "gradient-thumb-2",
              "gradient-thumb-3",
              "gradient-thumb-4",
              "gradient-thumb-5",
              "gradient-thumb-6",
              "gradient-thumb-7",
              "gradient-thumb-8",
            ] as const
          ).map((g) => (
            <div key={g} className={cn("h-14 border border-border-subtle", g)} title={g} />
          ))}
        </div>
      </Section>

      <footer className="border-t border-border-subtle pt-8 text-center text-mono-sm text-text-disabled">
        <Palette className="mx-auto mb-2 h-5 w-5 text-text-accent opacity-60" aria-hidden />
        Design language preview — not linked from production navigation.
      </footer>
    </div>
  );
}
