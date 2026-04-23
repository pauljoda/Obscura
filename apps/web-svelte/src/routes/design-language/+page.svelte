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
</script>

<svelte:head>
  <title>Design language — Obscura</title>
  <meta name="robots" content="noindex,nofollow" />
</svelte:head>

<main class="min-h-screen bg-bg text-text-primary">
  <div class="mx-auto max-w-6xl px-6 py-10 space-y-10">
    <header class="space-y-2">
      <p class="text-label text-text-muted tracking-[0.12em] uppercase">
        Obscura / Design System
      </p>
      <h1 class="font-heading text-3xl">Design language — parity page</h1>
      <p class="text-text-secondary max-w-2xl">
        Every primitive and composed component from <code>@obscura/ui-svelte</code> rendered
        for visual verification inside the live Svelte runtime.
      </p>
    </header>

    <!-- Typography -->
    <section class="space-y-4">
      <h2 class="text-h2">Typography</h2>
      <Panel>
        <div class="p-4 space-y-2">
          <p class="text-display">Display · Obscura</p>
          <p class="text-h1">H1 · Dark Room</p>
          <p class="text-h2">H2 · Brass &amp; Glass</p>
          <p class="text-h3">H3 · Sharp corners</p>
          <p class="text-body">Body · The quick brown fox jumps over the lazy dog.</p>
          <p class="text-label text-text-muted">Label · Uppercase 0.04em</p>
          <p class="text-mono text-text-accent">Mono · 0x2a4f00 // <span class="text-phosphor-500">phosphor</span></p>
        </div>
      </Panel>
    </section>

    <!-- Buttons -->
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

    <!-- Badges -->
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

    <!-- Checkbox -->
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

    <!-- StatusLed -->
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

    <!-- Meter -->
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

    <!-- Panel variants -->
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

    <!-- MediaCard -->
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
  </div>
</main>
