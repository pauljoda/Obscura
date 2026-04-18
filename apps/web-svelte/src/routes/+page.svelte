<script lang="ts">
  import {
    Film,
    Images,
    Image as ImageIcon,
    Music,
    Users,
    Building2,
    Tags,
    FolderOpen,
    ScanSearch,
    Puzzle,
    Activity,
    Settings,
  } from "@lucide/svelte";
  import { Panel, StatusLed } from "@obscura/ui-svelte";

  const shortcuts = [
    { label: "Videos", href: "/videos", icon: Film },
    { label: "Galleries", href: "/galleries", icon: Images },
    { label: "Images", href: "/images", icon: ImageIcon },
    { label: "Audio", href: "/audio", icon: Music },
    { label: "Actors", href: "/performers", icon: Users },
    { label: "Studios", href: "/studios", icon: Building2 },
    { label: "Tags", href: "/tags", icon: Tags },
    { label: "Collections", href: "/collections", icon: FolderOpen },
    { label: "Identify", href: "/identify", icon: ScanSearch },
    { label: "Plugins", href: "/plugins", icon: Puzzle },
    { label: "Jobs", href: "/jobs", icon: Activity },
    { label: "Settings", href: "/settings", icon: Settings },
  ];
</script>

<svelte:head>
  <title>Dashboard — Obscura</title>
</svelte:head>

<div class="space-y-8">
  <header class="flex items-center gap-3">
    <StatusLed status="active" pulse />
    <div>
      <p class="text-kicker text-text-muted">Overview</p>
      <h1 class="text-h1 text-text-primary">Dashboard</h1>
    </div>
  </header>

  <section class="space-y-3">
    <h2 class="text-label text-text-muted">Quick nav</h2>
    <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
      {#each shortcuts as s (s.href)}
        {@const Icon = s.icon}
        <a
          href={s.href}
          class="surface-card-sharp p-4 flex flex-col items-center gap-2 hover:border-border-accent transition-colors duration-fast"
        >
          <Icon class="h-5 w-5 text-accent-500" />
          <span class="text-body-sm text-text-primary">{s.label}</span>
        </a>
      {/each}
    </div>
  </section>

  <!-- TODO Phase 6 deep-port: recent activity, recent additions, featured, stats. APP-86..87 -->
  <Panel>
    <div class="p-5 space-y-2">
      <h2 class="text-h3 text-text-primary">Port in progress</h2>
      <p class="text-body text-text-muted">
        The richer dashboard (recent activity, recent additions, featured section, stats) lands
        with Phase 6 of the SvelteKit port. Linear tracking:
        <strong>APP-86 · APP-87 · APP-89 · APP-90</strong>.
      </p>
      <p class="text-body-sm text-text-disabled">
        In the meantime the Next.js app on <code class="text-accent-300">:8008</code> still serves
        the full dashboard.
      </p>
    </div>
  </Panel>
</div>
