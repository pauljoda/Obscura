<script lang="ts">
  import {
    Badge,
    Button,
    Checkbox,
    MediaCard,
    Meter,
    Panel,
    StatusLed,
    type LedStatus,
  } from "@obscura/ui-svelte";
  import LogoMark from "$lib/components/LogoMark.svelte";

  const ledStatuses: LedStatus[] = [
    "active",
    "warning",
    "error",
    "info",
    "idle",
    "accent",
    "phosphor",
  ];

  let demoChecked = $state(false);
  let demoIndeterminate = $state(true);

  const surfaceLevels = [
    { label: "bg", css: "var(--color-bg)", hex: "#07080b" },
    { label: "surface-1", css: "var(--color-surface-1)", hex: "#0c0f15" },
    { label: "surface-2", css: "var(--color-surface-2)", hex: "#101420" },
    { label: "surface-3", css: "var(--color-surface-3)", hex: "#151a28" },
    { label: "surface-4", css: "var(--color-surface-4)", hex: "#1c2235" },
  ];

  const glassLevels = [
    { label: "glass-1", opacity: "72%", blur: "12px" },
    { label: "glass-2", opacity: "82%", blur: "16px" },
    { label: "glass-3", opacity: "92%", blur: "24px" },
  ];

  const accentScale = [
    { label: "950", hex: "#131008" },
    { label: "900", hex: "#261f0f" },
    { label: "800", hex: "#3d3016" },
    { label: "700", hex: "#5a4620" },
    { label: "600", hex: "#7a5e2c" },
    { label: "500", hex: "#c49a5a" },
    { label: "400", hex: "#d4af74" },
    { label: "300", hex: "#e0c48e" },
    { label: "200", hex: "#ebdaaf" },
    { label: "100", hex: "#f5efd5" },
    { label: "50", hex: "#faf6ea" },
  ];

  const textColors = [
    { label: "primary", css: "text-text-primary", hex: "#f2eed8" },
    { label: "secondary", css: "text-text-secondary", hex: "#c4c9d4" },
    { label: "muted", css: "text-text-muted", hex: "#8a93a6" },
    { label: "disabled", css: "text-text-disabled", hex: "#4a5260" },
    { label: "accent", css: "text-text-accent", hex: "#c49a5a" },
  ];

  const statusColors = [
    { label: "success", hex: "#4e8a62", text: "#80b898" },
    { label: "warning", hex: "#b09040", text: "#ccb060" },
    { label: "error", hex: "#a84850", text: "#cc7880" },
    { label: "info", hex: "#4478a8", text: "#70a4cc" },
  ];
</script>

<svelte:head>
  <title>Design language — Obscura</title>
  <meta name="robots" content="noindex,nofollow" />
</svelte:head>

<main class="min-h-screen bg-bg text-text-primary">
  <div class="mx-auto max-w-6xl px-6 py-10 space-y-12">
    <header class="space-y-3">
      <div class="flex items-center gap-4">
        <LogoMark size={48} />
        <div>
          <p class="text-label text-text-muted tracking-[0.12em] uppercase">
            Obscura / Design System
          </p>
          <h1 class="font-heading text-3xl">Dark Room</h1>
        </div>
      </div>
      <p class="text-text-secondary max-w-2xl">
        The full design language: tokens, primitives, and composed components from
        <code class="text-mono text-text-accent">@obscura/ui-svelte</code>, rendered for
        visual verification inside the live Svelte runtime.
      </p>
      <a href="/dev/v2-migration" class="inline-flex items-center gap-1 text-mono-sm text-text-muted hover:text-text-accent transition-colors">
        ← Back to Dev Tools
      </a>
    </header>

    <!-- ── Logo ── -->
    <section class="space-y-4">
      <h2 class="text-h2">LogoMark</h2>
      <Panel>
        <div class="p-6 flex items-end gap-8">
          <div class="flex flex-col items-center gap-2">
            <LogoMark size={24} />
            <span class="text-mono-sm text-text-muted">24px</span>
          </div>
          <div class="flex flex-col items-center gap-2">
            <LogoMark size={48} />
            <span class="text-mono-sm text-text-muted">48px</span>
          </div>
          <div class="flex flex-col items-center gap-2">
            <LogoMark size={96} />
            <span class="text-mono-sm text-text-muted">96px</span>
          </div>
        </div>
      </Panel>
    </section>

    <!-- ── Surface Hierarchy ── -->
    <section class="space-y-4">
      <h2 class="text-h2">Surface Hierarchy</h2>
      <p class="text-body text-text-secondary">Five-level material surface stack: bg → surface-1 → surface-2 → surface-3 → surface-4.</p>
      <div class="grid grid-cols-5 gap-0">
        {#each surfaceLevels as level}
          <div
            class="h-24 flex flex-col items-center justify-end pb-3 border border-border-subtle"
            style="background: {level.css}"
          >
            <span class="text-mono-sm text-text-primary">{level.label}</span>
            <span class="text-mono-sm text-text-muted">{level.hex}</span>
          </div>
        {/each}
      </div>
    </section>

    <!-- ── Glass Layers ── -->
    <section class="space-y-4">
      <h2 class="text-h2">Glass Layers</h2>
      <p class="text-body text-text-secondary">Glass: <code class="text-mono text-text-accent">backdrop-filter: blur</code> + semi-transparent fill for floating and interactive elements.</p>
      <div class="relative h-48 overflow-hidden border border-border-subtle">
        <div class="absolute inset-0 bg-gradient-to-br from-accent-800 via-accent-950 to-surface-1"></div>
        <div class="absolute inset-0 flex items-center justify-center gap-4 p-4">
          {#each glassLevels as glass}
            <div
              class="glass-demo flex-1 h-full flex flex-col items-center justify-center border border-border-subtle"
              style="background: var(--color-{glass.label}); backdrop-filter: blur({glass.blur})"
            >
              <span class="text-mono-sm text-text-primary">{glass.label}</span>
              <span class="text-mono-sm text-text-muted">{glass.opacity} · {glass.blur}</span>
            </div>
          {/each}
        </div>
      </div>
    </section>

    <!-- ── Accent Scale ── -->
    <section class="space-y-4">
      <h2 class="text-h2">Accent Scale — Brass</h2>
      <div class="flex">
        {#each accentScale as swatch}
          <div
            class="flex-1 h-16 flex flex-col items-center justify-end pb-1"
            style="background: {swatch.hex}"
          >
            <span class="text-mono-sm" style="color: {parseInt(swatch.label) >= 500 ? '#131008' : '#f2eed8'}">{swatch.label}</span>
          </div>
        {/each}
      </div>
    </section>

    <!-- ── Text Colors ── -->
    <section class="space-y-4">
      <h2 class="text-h2">Text Colors</h2>
      <Panel>
        <div class="p-4 space-y-2">
          {#each textColors as tc}
            <div class="flex items-center gap-4">
              <span class="w-4 h-4 shrink-0" style="background: {tc.hex}"></span>
              <span class={tc.css}>The quick brown fox — {tc.label}</span>
              <span class="text-mono-sm text-text-disabled ml-auto">{tc.hex}</span>
            </div>
          {/each}
        </div>
      </Panel>
    </section>

    <!-- ── Status Colors ── -->
    <section class="space-y-4">
      <h2 class="text-h2">Status Colors</h2>
      <Panel>
        <div class="p-4 flex flex-wrap gap-6">
          {#each statusColors as sc}
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 flex items-center justify-center" style="background: {sc.hex}; box-shadow: 0 0 8px {sc.hex}66">
                <div class="w-3 h-3" style="background: {sc.text}"></div>
              </div>
              <div>
                <span class="text-body" style="color: {sc.text}">{sc.label}</span>
                <span class="text-mono-sm text-text-disabled block">{sc.hex}</span>
              </div>
            </div>
          {/each}
        </div>
      </Panel>
    </section>

    <!-- ── Glow Effects ── -->
    <section class="space-y-4">
      <h2 class="text-h2">Glow Effects</h2>
      <Panel>
        <div class="p-6 flex flex-wrap items-center gap-8">
          <div class="flex flex-col items-center gap-3">
            <div class="w-20 h-20 bg-surface-2 border border-border-accent" style="box-shadow: var(--shadow-glow-accent)"></div>
            <span class="text-mono-sm text-text-muted">glow-subtle</span>
          </div>
          <div class="flex flex-col items-center gap-3">
            <div class="w-20 h-20 bg-surface-2 border border-border-accent" style="box-shadow: var(--shadow-glow-accent-full)"></div>
            <span class="text-mono-sm text-text-muted">glow-full</span>
          </div>
          <div class="flex flex-col items-center gap-3">
            <div class="w-20 h-20 bg-surface-2 glow-pulse"></div>
            <span class="text-mono-sm text-text-muted">glow-pulse</span>
          </div>
        </div>
      </Panel>
    </section>

    <!-- ── Loading Animations ── -->
    <section class="space-y-4">
      <h2 class="text-h2">Loading Animations</h2>
      <Panel>
        <div class="p-6 flex flex-wrap items-start gap-12">
          <div class="flex flex-col items-center gap-3">
            <div class="relative flex items-center justify-center w-20 h-20">
              <div class="route-loader-core-field"></div>
              <div class="route-loader-ripples">
                <div class="route-loader-ripple-ring"></div>
                <div class="route-loader-ripple-ring"></div>
                <div class="route-loader-ripple-ring"></div>
              </div>
              <LogoMark size={32} alt="" />
            </div>
            <span class="text-mono-sm text-text-muted">route loader</span>
          </div>
          <div class="flex flex-col items-center gap-3">
            <div class="w-20 h-20 flex items-center justify-center">
              <div class="spinner-inline w-8 h-8">
                <div class="spinner-inline-outer"></div>
                <div class="spinner-inline-inner"></div>
                <div class="spinner-inline-core"></div>
              </div>
            </div>
            <span class="text-mono-sm text-text-muted">inline spinner</span>
          </div>
          <div class="flex flex-col items-center gap-3">
            <div class="w-20 h-20 flex items-center justify-end gap-[3px] pb-4 pl-3">
              {#each [0, 0.15, 0.3, 0.45] as delay}
                <div
                  class="w-[3px] h-5 bg-accent-500/70"
                  style="animation: bar-bounce 0.85s {delay}s ease-in-out infinite"
                ></div>
              {/each}
            </div>
            <span class="text-mono-sm text-text-muted">bar bounce</span>
          </div>
          <div class="flex flex-col items-center gap-3">
            <div class="w-20 h-20 shimmer-demo"></div>
            <span class="text-mono-sm text-text-muted">shimmer</span>
          </div>
        </div>
      </Panel>
    </section>

    <!-- ── Typography ── -->
    <section class="space-y-4">
      <h2 class="text-h2">Typography</h2>
      <Panel>
        <div class="p-4 space-y-3">
          <p class="text-display">Display · Obscura</p>
          <p class="text-h1">H1 · Dark Room</p>
          <p class="text-h2">H2 · Brass &amp; Glass</p>
          <p class="text-h3">H3 · Sharp corners everywhere</p>
          <p class="text-body">Body · The quick brown fox jumps over the lazy dog.</p>
          <p class="text-body-sm text-text-secondary">Body sm · Secondary metadata and supplemental text.</p>
          <p class="text-label text-text-muted uppercase">Label · tracking 0.04em</p>
          <p class="text-mono text-text-accent">Mono · 0x2a4f00 // <span class="text-phosphor-500">phosphor</span></p>
          <p class="text-mono-sm text-text-muted">Mono sm · timestamps, file sizes, technical data</p>
          <p class="text-glow-accent font-heading text-lg">Glow accent · active state text</p>
        </div>
      </Panel>
    </section>

    <!-- ── Buttons ── -->
    <section class="space-y-4">
      <h2 class="text-h2">Button</h2>
      <Panel>
        <div class="p-4 flex flex-wrap items-end gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="primary" size="sm">Small</Button>
          <Button variant="primary" size="lg">Large</Button>
          <Button variant="primary" disabled>Disabled</Button>
        </div>
      </Panel>
    </section>

    <!-- ── Badges ── -->
    <section class="space-y-4">
      <h2 class="text-h2">Badge</h2>
      <Panel>
        <div class="p-4 flex flex-wrap gap-2">
          <Badge>default</Badge>
          <Badge variant="accent">accent</Badge>
          <Badge variant="success">success</Badge>
          <Badge variant="warning">warning</Badge>
          <Badge variant="error">error</Badge>
          <Badge variant="info">info</Badge>
        </div>
      </Panel>
    </section>

    <!-- ── Checkbox ── -->
    <section class="space-y-4">
      <h2 class="text-h2">Checkbox</h2>
      <Panel>
        <div class="p-4 flex flex-wrap items-center gap-6">
          <label class="flex items-center gap-2 text-body">
            <Checkbox
              checked={demoChecked}
              onchange={(e) => (demoChecked = (e.currentTarget as HTMLInputElement).checked)}
            />
            Checked ({String(demoChecked)})
          </label>
          <label class="flex items-center gap-2 text-body">
            <Checkbox indeterminate={demoIndeterminate} />
            Indeterminate
          </label>
          <label class="flex items-center gap-2 text-body">
            <Checkbox disabled />
            Disabled
          </label>
          <label class="flex items-center gap-2 text-body">
            <Checkbox size="md" checked />
            Size md
          </label>
        </div>
      </Panel>
    </section>

    <!-- ── StatusLed ── -->
    <section class="space-y-4">
      <h2 class="text-h2">StatusLed</h2>
      <Panel>
        <div class="p-4 flex flex-wrap items-center gap-6">
          {#each ledStatuses as status}
            <div class="flex items-center gap-2 text-label">
              <StatusLed {status} />
              {status}
            </div>
          {/each}
          <div class="flex items-center gap-2 text-label">
            <StatusLed status="active" pulse />
            active · pulse
          </div>
          <div class="flex items-center gap-2 text-label">
            <StatusLed status="accent" size="lg" pulse />
            accent · lg · pulse
          </div>
        </div>
      </Panel>
    </section>

    <!-- ── Meter ── -->
    <section class="space-y-4">
      <h2 class="text-h2">Meter</h2>
      <Panel>
        <div class="p-4 grid md:grid-cols-2 gap-6 max-w-3xl">
          <Meter value={32} label="Storage" showValue />
          <Meter value={78} label="CPU" showValue variant="phosphor" />
          <Meter value={12} label="Low" showValue />
          <Meter value={96} label="High" showValue variant="phosphor" />
        </div>
      </Panel>
    </section>

    <!-- ── Panel variants ── -->
    <section class="space-y-4">
      <h2 class="text-h2">Panel variants</h2>
      <div class="grid md:grid-cols-3 gap-3">
        <Panel variant="panel">
          <div class="p-4 text-body">panel</div>
        </Panel>
        <Panel variant="well">
          <div class="p-4 text-body">well</div>
        </Panel>
        <Panel variant="elevated">
          <div class="p-4 text-body">elevated</div>
        </Panel>
      </div>
    </section>

    <!-- ── Borders ── -->
    <section class="space-y-4">
      <h2 class="text-h2">Borders</h2>
      <Panel>
        <div class="p-4 flex flex-wrap gap-4">
          <div class="w-24 h-16 bg-surface-2 flex items-center justify-center border border-border-subtle">
            <span class="text-mono-sm text-text-muted">subtle</span>
          </div>
          <div class="w-24 h-16 bg-surface-2 flex items-center justify-center border border-border-default">
            <span class="text-mono-sm text-text-muted">default</span>
          </div>
          <div class="w-24 h-16 bg-surface-2 flex items-center justify-center border border-border-accent">
            <span class="text-mono-sm text-text-muted">accent</span>
          </div>
          <div class="w-24 h-16 bg-surface-2 flex items-center justify-center" style="border: 1px solid var(--color-border-accent-strong)">
            <span class="text-mono-sm text-text-accent">strong</span>
          </div>
          <div class="w-24 h-16 bg-surface-2 flex items-center justify-center" style="border: 1px solid var(--color-border-glow); box-shadow: var(--shadow-glow-accent)">
            <span class="text-mono-sm text-text-accent">glow</span>
          </div>
        </div>
      </Panel>
    </section>

    <!-- ── MediaCard ── -->
    <section class="space-y-4">
      <h2 class="text-h2">MediaCard</h2>
      <div class="grid md:grid-cols-3 gap-3">
        <MediaCard
          title="Sample video, brass and glass"
          duration="32:14"
          resolution="1080p"
          codec="AV1"
          hasSubtitles
          studio="Dark Room"
          performers={["First Performer", "Second Performer"]}
          tags={["cinematic", "noir", "b-roll"]}
          rating={80}
          views={1248}
          fileSize="2.1 GB"
        />
        <MediaCard
          title="No thumbnail fallback"
          duration="7:55"
          resolution="720p"
          codec="H264"
          gradientClass="bg-gradient-to-br from-accent-900 via-accent-800 to-accent-950"
        />
        <MediaCard
          title="Minimal card"
          duration="2:02"
        />
      </div>
    </section>

    <!-- ── Design Principles ── -->
    <section class="space-y-4">
      <h2 class="text-h2">Design Principles</h2>
      <div class="grid md:grid-cols-2 gap-3">
        <Panel>
          <div class="p-4 space-y-2">
            <h3 class="text-h3 text-text-accent">Sharp corners everywhere</h3>
            <p class="text-body text-text-secondary">
              <code class="text-mono text-text-accent">border-radius: 0</code> on all elements, no exceptions.
              The angular aesthetic is a core part of the Dark Room identity.
            </p>
          </div>
        </Panel>
        <Panel>
          <div class="p-4 space-y-2">
            <h3 class="text-h3 text-text-accent">Glow expresses state</h3>
            <p class="text-body text-text-secondary">
              Selection, focus, and activity use <code class="text-mono text-text-accent">glow-pulse</code> or
              full glow <code class="text-mono text-text-accent">box-shadow</code>. No static color-only state changes.
            </p>
          </div>
        </Panel>
        <Panel>
          <div class="p-4 space-y-2">
            <h3 class="text-h3 text-text-accent">Material base + glass overlay</h3>
            <p class="text-body text-text-secondary">
              Solid dark surfaces as the ground layer; glass (<code class="text-mono text-text-accent">backdrop-filter: blur</code>)
              for floating and interactive elements.
            </p>
          </div>
        </Panel>
        <Panel>
          <div class="p-4 space-y-2">
            <h3 class="text-h3 text-text-accent">Brass accent only on active</h3>
            <p class="text-body text-text-secondary">
              <span class="text-text-accent">#c49a5a</span> is reserved for active/selected states.
              Always expressed with glow, never flat.
            </p>
          </div>
        </Panel>
      </div>
    </section>
  </div>
</main>

<style>
  .shimmer-demo {
    background: linear-gradient(
      90deg,
      var(--color-surface-2) 0%,
      var(--color-surface-3) 40%,
      var(--color-surface-2) 80%
    );
    background-size: 200% 100%;
    animation: shimmer 1.15s linear infinite;
    border: 1px solid var(--color-border-subtle);
  }

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
</style>
