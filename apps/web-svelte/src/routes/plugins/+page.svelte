<script lang="ts">
  import { onMount } from "svelte";
  import {
    AlertCircle,
    Boxes,
    Check,
    Download,
    Film,
    Globe,
    Loader2,
    Package,
    Pencil,
    Plug,
    Plus,
    Puzzle,
    RefreshCw,
    Save,
    Search,
    Sparkles,
    ToggleLeft,
    ToggleRight,
    Trash2,
    Users,
    X,
  } from "@lucide/svelte";
  import { Badge, Button } from "@obscura/ui-svelte";
  import { useNsfw } from "$lib/stores/nsfw.svelte";
  import { entityTerms } from "$lib/terminology";
  import {
    fetchCommunityIndex,
    fetchInstalledScrapers,
    fetchInstalledPlugins,
    fetchObscuraPluginIndex,
    fetchPluginUpdates,
    fetchStashBoxEndpoints,
    installObscuraPlugin,
    installScraper,
    uninstallScraper,
    uninstallPlugin,
    toggleScraper,
    togglePlugin,
    createStashBoxEndpoint,
    updateStashBoxEndpoint,
    deleteStashBoxEndpoint,
    testStashBoxEndpoint,
    type ObscuraPluginIndexEntry,
    type InstalledPlugin,
    type PluginUpdateStatus,
  } from "$lib/api/scrapers";
  import type {
    CommunityIndexEntry,
    ScraperPackage,
    StashBoxEndpoint,
  } from "$lib/api/types";

  /* ─── Capability label map ──────────────────────────────────── */

  const CAPABILITY_META: Record<string, { label: string; category: string }> = {
    sceneByURL: { label: "Video by URL", category: "scene" },
    sceneByFragment: { label: "Video by fragment", category: "scene" },
    sceneByName: { label: "Video by name", category: "scene" },
    sceneByQueryFragment: { label: "Video by query", category: "scene" },
    performerByURL: { label: "Actor by URL", category: "performer" },
    performerByName: { label: "Actor by name", category: "performer" },
    performerByFragment: { label: "Actor by fragment", category: "performer" },
    galleryByURL: { label: "Gallery by URL", category: "gallery" },
    galleryByFragment: { label: "Gallery by fragment", category: "gallery" },
    groupByURL: { label: "Group by URL", category: "group" },
    videoByURL: { label: "Video by URL", category: "scene" },
    videoByName: { label: "Video by name", category: "scene" },
    folderByName: { label: "Series by name", category: "folder" },
    folderCascade: { label: "Episode cascade", category: "folder" },
    audioByURL: { label: "Audio by URL", category: "audio" },
    audioLibraryByName: { label: "Album by name", category: "audio" },
  };

  type PluginsTab = "installed" | "obscura-index" | "stash-index" | "stashbox";
  type CapFilter = "all" | "scene" | "performer";

  const nsfw = useNsfw();
  const isSfw = $derived(nsfw.mode === "off");

  /* ─── State ───────────────────────────────────────────────── */

  let tab = $state<PluginsTab>("installed");
  let loading = $state(true);
  let error = $state<string | null>(null);
  let message = $state<string | null>(null);

  let installed = $state<ScraperPackage[]>([]);
  let installedPlugins = $state<InstalledPlugin[]>([]);
  let pluginUpdates = $state<Record<string, PluginUpdateStatus>>({});
  let updatingPluginId = $state<string | null>(null);
  let checkingUpdates = $state(false);
  let capFilter = $state<CapFilter>("all");
  let installedSearch = $state("");

  let indexEntries = $state<CommunityIndexEntry[]>([]);
  let indexLoading = $state(false);
  let indexLoaded = $state(false);
  let indexSearch = $state("");
  let installingId = $state<string | null>(null);

  let obscuraEntries = $state<ObscuraPluginIndexEntry[]>([]);
  let obscuraLoading = $state(false);
  let obscuraLoaded = $state(false);
  let obscuraSearch = $state("");
  let obscuraInstallingId = $state<string | null>(null);

  let stashBoxEndpoints = $state<StashBoxEndpoint[]>([]);
  let showStashBoxForm = $state(false);
  let editingStashBox = $state<StashBoxEndpoint | null>(null);
  let sbName = $state("");
  let sbEndpoint = $state("");
  let sbApiKey = $state("");
  let sbSaving = $state(false);
  let sbTesting = $state<string | null>(null);
  let sbTestResult = $state<{ id: string; valid: boolean; error?: string } | null>(null);

  function flashMessage(msg: string) {
    message = msg;
    setTimeout(() => {
      if (message === msg) message = null;
    }, 3000);
  }

  /* ─── Data loading ────────────────────────────────────────── */

  async function loadPluginUpdates(refresh = false) {
    checkingUpdates = true;
    try {
      const rows = await fetchPluginUpdates({ refresh });
      const map: Record<string, PluginUpdateStatus> = {};
      for (const row of rows) map[row.pluginId] = row;
      pluginUpdates = map;
    } catch {
      /* registry unreachable — ignore */
    } finally {
      checkingUpdates = false;
    }
  }

  async function loadInstalled() {
    try {
      const [scrapersRes, endpointsRes, pluginsRes] = await Promise.all([
        fetchInstalledScrapers(),
        fetchStashBoxEndpoints().catch(() => ({ endpoints: [] as StashBoxEndpoint[] })),
        fetchInstalledPlugins().catch(() => [] as InstalledPlugin[]),
      ]);
      installed = scrapersRes.packages;
      stashBoxEndpoints = endpointsRes.endpoints;
      installedPlugins = pluginsRes;
      if (pluginsRes.length > 0) void loadPluginUpdates(false);
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load plugins";
    } finally {
      loading = false;
    }
  }

  async function loadStashIndex(force = false) {
    indexLoading = true;
    error = null;
    try {
      const res = await fetchCommunityIndex(force);
      indexEntries = res.entries;
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to fetch community index";
    } finally {
      indexLoaded = true;
      indexLoading = false;
    }
  }

  async function loadObscuraIndex() {
    obscuraLoading = true;
    error = null;
    try {
      const entries = await fetchObscuraPluginIndex();
      obscuraEntries = entries;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("404") && !msg.includes("not found") && !msg.includes("not configured")) {
        error = msg;
      }
    } finally {
      obscuraLoaded = true;
      obscuraLoading = false;
    }
  }

  onMount(() => {
    void loadInstalled();
  });

  // In SFW mode, force tab away from NSFW tabs.
  $effect(() => {
    if (isSfw && (tab === "stash-index" || tab === "stashbox")) tab = "installed";
  });

  // Auto-load indices when switching tabs.
  $effect(() => {
    if (tab === "stash-index" && !indexLoaded && !indexLoading) void loadStashIndex();
    if (tab === "obscura-index" && !obscuraLoaded && !obscuraLoading) void loadObscuraIndex();
  });

  /* ─── Actions ─────────────────────────────────────────────── */

  async function handleToggle(pkg: ScraperPackage) {
    try {
      const updated = await toggleScraper(pkg.id, !pkg.enabled);
      installed = installed.map((p) => (p.id === updated.id ? updated : p));
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to toggle";
    }
  }

  async function handleUninstall(pkg: ScraperPackage) {
    error = null;
    try {
      await uninstallScraper(pkg.id);
      flashMessage(`Removed ${pkg.name}`);
      await loadInstalled();
      indexEntries = indexEntries.map((e) =>
        e.id === pkg.packageId ? { ...e, installed: false } : e,
      );
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to remove";
    }
  }

  async function handleInstall(packageId: string) {
    installingId = packageId;
    error = null;
    try {
      await installScraper(packageId);
      flashMessage(`Installed ${packageId}`);
      await loadInstalled();
      indexEntries = indexEntries.map((e) =>
        e.id === packageId ? { ...e, installed: true } : e,
      );
    } catch (err) {
      error = err instanceof Error ? err.message : `Failed to install ${packageId}`;
    } finally {
      installingId = null;
    }
  }

  async function handleObscuraInstall(entry: ObscuraPluginIndexEntry) {
    obscuraInstallingId = entry.id;
    error = null;
    try {
      await installObscuraPlugin(entry.id, {
        localPath: entry.localPath,
        zipUrl: entry.localPath ? undefined : entry.path,
        sha256: entry.sha256 || undefined,
      });
      flashMessage(`Installed ${entry.name}`);
      obscuraEntries = obscuraEntries.map((e) =>
        e.id === entry.id ? { ...e, installed: true } : e,
      );
      await loadInstalled();
    } catch (err) {
      error = err instanceof Error ? err.message : `Failed to install ${entry.name}`;
    } finally {
      obscuraInstallingId = null;
    }
  }

  async function handlePluginUpdate(plugin: InstalledPlugin) {
    const update = pluginUpdates[plugin.pluginId];
    if (!update || !update.updateAvailable || !update.zipUrl) return;
    updatingPluginId = plugin.id;
    error = null;
    try {
      await installObscuraPlugin(plugin.pluginId, {
        zipUrl: update.zipUrl,
        sha256: update.sha256 || undefined,
      });
      flashMessage(`Updated ${plugin.name} → v${update.availableVersion}`);
      await loadInstalled();
      await loadPluginUpdates(true);
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to update plugin";
    } finally {
      updatingPluginId = null;
    }
  }

  async function handlePluginToggle(plugin: InstalledPlugin) {
    try {
      await togglePlugin(plugin.id, !plugin.enabled);
      installedPlugins = installedPlugins.map((p) =>
        p.id === plugin.id ? { ...p, enabled: !p.enabled } : p,
      );
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to toggle";
    }
  }

  async function handlePluginRemove(plugin: InstalledPlugin) {
    try {
      await uninstallPlugin(plugin.id);
      flashMessage(`Removed ${plugin.name}`);
      installedPlugins = installedPlugins.filter((p) => p.id !== plugin.id);
      obscuraEntries = obscuraEntries.map((e) =>
        e.id === plugin.pluginId ? { ...e, installed: false } : e,
      );
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to remove";
    }
  }

  function openAddStashBox() {
    editingStashBox = null;
    sbName = "";
    sbEndpoint = "";
    sbApiKey = "";
    sbTestResult = null;
    showStashBoxForm = true;
  }

  function openEditStashBox(ep: StashBoxEndpoint) {
    editingStashBox = ep;
    sbName = ep.name;
    sbEndpoint = ep.endpoint;
    sbApiKey = "";
    sbTestResult = null;
    showStashBoxForm = true;
  }

  async function saveStashBox() {
    sbSaving = true;
    error = null;
    try {
      if (editingStashBox) {
        const updates: { name?: string; endpoint?: string; apiKey?: string } = {};
        if (sbName !== editingStashBox.name) updates.name = sbName;
        if (sbEndpoint !== editingStashBox.endpoint) updates.endpoint = sbEndpoint;
        if (sbApiKey) updates.apiKey = sbApiKey;
        const updated = await updateStashBoxEndpoint(editingStashBox.id, updates);
        stashBoxEndpoints = stashBoxEndpoints.map((e) => (e.id === updated.id ? updated : e));
      } else {
        if (!sbApiKey) {
          error = "API key is required";
          sbSaving = false;
          return;
        }
        const created = await createStashBoxEndpoint({
          name: sbName,
          endpoint: sbEndpoint,
          apiKey: sbApiKey,
        });
        stashBoxEndpoints = [...stashBoxEndpoints, created];
      }
      showStashBoxForm = false;
      flashMessage(editingStashBox ? "Endpoint updated." : "Endpoint added.");
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to save";
    } finally {
      sbSaving = false;
    }
  }

  async function testEndpoint(ep: StashBoxEndpoint) {
    sbTesting = ep.id;
    sbTestResult = null;
    try {
      const r = await testStashBoxEndpoint(ep.id);
      sbTestResult = { id: ep.id, ...r };
    } catch {
      sbTestResult = { id: ep.id, valid: false, error: "Request failed" };
    } finally {
      sbTesting = null;
    }
  }

  async function toggleEndpointEnabled(ep: StashBoxEndpoint) {
    try {
      await updateStashBoxEndpoint(ep.id, { enabled: !ep.enabled });
      stashBoxEndpoints = stashBoxEndpoints.map((e) =>
        e.id === ep.id ? { ...e, enabled: !e.enabled } : e,
      );
      flashMessage(`${ep.name} ${ep.enabled ? "disabled" : "enabled"}.`);
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to toggle";
    }
  }

  async function deleteEndpoint(ep: StashBoxEndpoint) {
    try {
      await deleteStashBoxEndpoint(ep.id);
      stashBoxEndpoints = stashBoxEndpoints.filter((e) => e.id !== ep.id);
      flashMessage(`${ep.name} removed.`);
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to remove";
    }
  }

  /* ─── Derived filtering ───────────────────────────────────── */

  const visibleInstalled = $derived(isSfw ? installed.filter((p) => !p.isNsfw) : installed);
  const visiblePlugins = $derived(
    isSfw ? installedPlugins.filter((p) => !p.isNsfw) : installedPlugins,
  );

  const filteredInstalled = $derived.by(() => {
    const q = installedSearch.trim().toLowerCase();
    return visibleInstalled.filter((pkg) => {
      if (q && !pkg.name.toLowerCase().includes(q) && !pkg.packageId.toLowerCase().includes(q)) {
        return false;
      }
      if (capFilter === "all") return true;
      const caps = pkg.capabilities as Record<string, boolean> | null;
      if (!caps) return false;
      if (capFilter === "scene")
        return !!(caps.sceneByURL || caps.sceneByFragment || caps.sceneByName || caps.sceneByQueryFragment);
      if (capFilter === "performer")
        return !!(caps.performerByURL || caps.performerByName || caps.performerByFragment);
      return true;
    });
  });

  const videoCount = $derived(
    visibleInstalled.filter((pkg) => {
      const caps = pkg.capabilities as Record<string, boolean> | null;
      return !!caps && (caps.sceneByURL || caps.sceneByFragment || caps.sceneByName);
    }).length,
  );
  const performerCount = $derived(
    visibleInstalled.filter((pkg) => {
      const caps = pkg.capabilities as Record<string, boolean> | null;
      return !!caps && (caps.performerByURL || caps.performerByName || caps.performerByFragment);
    }).length,
  );

  const filteredObscura = $derived.by(() => {
    const q = obscuraSearch.trim().toLowerCase();
    const list = q
      ? obscuraEntries.filter(
          (e) => e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q),
        )
      : obscuraEntries;
    return isSfw ? list.filter((e) => !e.isNsfw) : list;
  });

  const filteredIndex = $derived.by(() => {
    const q = indexSearch.trim().toLowerCase();
    return q
      ? indexEntries.filter(
          (e) => e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q),
        )
      : indexEntries;
  });

  type TabDef = { key: PluginsTab; label: string; count: number | null; nsfw: boolean };
  const visibleTabs = $derived<TabDef[]>(
    (
      [
        { key: "installed", label: "Installed", count: visibleInstalled.length, nsfw: false },
        {
          key: "obscura-index",
          label: "Obscura Community",
          count: obscuraEntries.length || null,
          nsfw: false,
        },
        {
          key: "stash-index",
          label: "Stash Community",
          count: indexEntries.length || null,
          nsfw: true,
        },
        {
          key: "stashbox",
          label: "StashBox Endpoints",
          count: stashBoxEndpoints.length,
          nsfw: true,
        },
      ] as TabDef[]
    ).filter((t) => !isSfw || !t.nsfw),
  );

  function tabIcon(key: PluginsTab) {
    if (key === "installed") return Boxes;
    if (key === "obscura-index") return Sparkles;
    if (key === "stash-index") return Globe;
    return Plug;
  }

  function enabledCaps(caps: Record<string, boolean> | null | undefined): string[] {
    if (!caps) return [];
    return Object.entries(caps)
      .filter(([, v]) => v)
      .map(([k]) => k);
  }
</script>

<svelte:head>
  <title>Obscura</title>
</svelte:head>

<div class="space-y-4">
  <!-- Header -->
  <div>
    <h1 class="flex items-center gap-2.5">
      <Puzzle class="h-5 w-5 text-text-accent" />
      Plugins
    </h1>
    <p class="mt-1 text-text-muted text-[0.78rem]">
      Install and manage identification plugins and metadata providers
    </p>
  </div>

  <!-- Stats -->
  <div class="grid gap-2 {isSfw ? 'grid-cols-2' : 'grid-cols-4'}">
    <div class="surface-stat px-3 py-2">
      <span class="text-kicker !text-text-disabled">Installed</span>
      <div class="text-lg font-semibold text-text-primary leading-tight">
        {visibleInstalled.length + visiblePlugins.length}
      </div>
    </div>
    {#if !isSfw}
      <div class="surface-stat px-3 py-2">
        <span class="text-kicker !text-text-disabled">{entityTerms.video} Scrapers</span>
        <div class="text-lg font-semibold text-text-primary leading-tight">{videoCount}</div>
      </div>
      <div class="surface-stat px-3 py-2">
        <span class="text-kicker !text-text-disabled">{entityTerms.performer} Scrapers</span>
        <div class="text-lg font-semibold text-text-primary leading-tight">{performerCount}</div>
      </div>
      <div class="surface-stat px-3 py-2">
        <span class="text-kicker !text-text-disabled">StashBox</span>
        <div class="text-lg font-semibold text-text-primary leading-tight">{stashBoxEndpoints.length}</div>
      </div>
    {:else}
      <div class="surface-stat px-3 py-2">
        <span class="text-kicker !text-text-disabled">Obscura Plugins</span>
        <div class="text-lg font-semibold text-text-primary leading-tight">
          {obscuraEntries.filter((e) => !e.isNsfw).length}
        </div>
      </div>
    {/if}
  </div>

  <!-- Messages -->
  {#if error}
    <div class="surface-well border-l-2 border-status-error px-3 py-2 text-sm text-status-error-text flex items-center gap-2">
      <span class="flex-1">{error}</span>
      <button
        onclick={() => (error = null)}
        aria-label="Dismiss error"
        class="text-text-disabled hover:text-text-muted"
      >
        <X class="h-3 w-3" />
      </button>
    </div>
  {/if}
  {#if message && !error}
    <div class="surface-well border-l-2 border-status-success px-3 py-2 text-sm text-status-success-text">
      {message}
    </div>
  {/if}

  {#if loading}
    <div class="flex items-center justify-center py-20">
      <Loader2 class="h-6 w-6 animate-spin text-text-muted" />
    </div>
  {:else}
    <!-- Tabs -->
    <div class="flex items-center gap-1 overflow-x-auto scrollbar-hidden">
      {#each visibleTabs as t (t.key)}
        {@const Icon = tabIcon(t.key)}
        <button
          onclick={() => (tab = t.key)}
          class={"flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-fast whitespace-nowrap " +
            (tab === t.key
              ? "bg-accent-950 text-text-accent border border-border-accent shadow-[var(--shadow-glow-accent)]"
              : "text-text-muted border border-transparent hover:text-text-secondary hover:bg-surface-3/40")}
        >
          <Icon class="h-3.5 w-3.5" />
          {t.label}
          {#if t.nsfw}
            <span
              class="tag-chip text-[0.5rem] bg-status-error/10 text-status-error-text border border-status-error/20 px-1 py-0"
            >
              NSFW
            </span>
          {/if}
          {#if t.count != null && t.count > 0}
            <span class="text-mono-sm text-text-disabled ml-1">{t.count}</span>
          {/if}
        </button>
      {/each}
    </div>

    <!-- INSTALLED TAB -->
    {#if tab === "installed"}
      <section class="space-y-2">
        <div class="surface-well flex items-center gap-2 px-3 py-2 flex-wrap">
          <div class="relative">
            <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-disabled" />
            <input
              class="control-input pl-8 w-56 py-1.5 text-sm"
              placeholder="Search installed..."
              bind:value={installedSearch}
            />
            {#if installedSearch}
              <button
                onclick={() => (installedSearch = "")}
                aria-label="Clear search"
                class="absolute right-2 top-1/2 -translate-y-1/2 text-text-disabled hover:text-text-muted"
              >
                <X class="h-3 w-3" />
              </button>
            {/if}
          </div>
          {#if !isSfw}
            <div class="w-px h-4 bg-border-subtle mx-1"></div>
            {#each ["all", "scene", "performer"] as const as filter}
              <button
                onclick={() => (capFilter = filter)}
                class={"flex items-center gap-1.5 px-2.5 py-1.5 text-xs transition-all duration-fast " +
                  (capFilter === filter
                    ? "bg-accent-950 text-text-accent border border-border-accent"
                    : "text-text-muted hover:text-text-secondary border border-transparent")}
              >
                {#if filter === "all"}
                  <Package class="h-3 w-3" />All
                {:else if filter === "scene"}
                  <Film class="h-3 w-3" />{entityTerms.videos}
                {:else}
                  <Users class="h-3 w-3" />{entityTerms.performers}
                {/if}
              </button>
            {/each}
          {/if}
          <div class="flex-1"></div>
          {#if installedPlugins.length > 0}
            <Button
              variant="ghost"
              size="sm"
              onclick={() => void loadPluginUpdates(true)}
              disabled={checkingUpdates}
              class="h-auto gap-1.5 px-2.5 py-1.5 text-xs"
            >
              {#snippet children()}
                {#if checkingUpdates}
                  <Loader2 class="h-3.5 w-3.5 animate-spin" />
                {:else}
                  <RefreshCw class="h-3.5 w-3.5" />
                {/if}
                Check for updates
              {/snippet}
            </Button>
          {/if}
          <span class="text-mono-sm text-text-disabled">{filteredInstalled.length} shown</span>
        </div>

        {#if filteredInstalled.length === 0 && visiblePlugins.length === 0}
          <div class="surface-card no-lift p-8 text-center">
            <Package class="h-8 w-8 text-text-disabled mx-auto mb-3" />
            <p class="text-text-muted text-sm">
              {#if visibleInstalled.length === 0 && installedPlugins.length === 0}
                {isSfw
                  ? "No SFW plugins installed. Browse the Obscura Community tab to find plugins."
                  : "No plugins installed. Browse the community tabs to get started."}
              {:else}
                No plugins match your filters.
              {/if}
            </p>
          </div>
        {:else}
          <div class="space-y-1">
            {#each visiblePlugins as plugin (plugin.id)}
              {@const update = pluginUpdates[plugin.pluginId]}
              {@const caps = enabledCaps(plugin.capabilities)}
              <div
                class={"surface-card no-lift p-4 transition-opacity duration-fast " +
                  (plugin.enabled ? "" : "opacity-60")}
              >
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2.5 flex-wrap">
                      <p class="text-sm font-semibold">{plugin.name}</p>
                      <span class="tag-chip tag-chip-accent text-[0.55rem]">Obscura</span>
                      {#if plugin.isNsfw}
                        <span class="tag-chip text-[0.55rem] bg-status-error/10 text-status-error-text border border-status-error/20">NSFW</span>
                      {/if}
                      <Badge variant={plugin.enabled ? "accent" : "default"}>
                        {#snippet children()}{plugin.enabled ? "Enabled" : "Disabled"}{/snippet}
                      </Badge>
                      {#if update?.updateAvailable}
                        <span class="inline-flex items-center gap-1 text-[0.55rem] px-1.5 py-0.5 bg-status-success/10 text-status-success-text border border-status-success/20">
                          <Sparkles class="h-2.5 w-2.5" />
                          Update available
                        </span>
                      {/if}
                    </div>
                    <p class="text-mono-sm text-text-disabled mt-0.5">
                      {plugin.pluginId} · v{plugin.version} · {plugin.runtime}
                    </p>
                    {#if caps.length > 0}
                      <div class="flex flex-wrap items-center gap-1.5 mt-2.5">
                        {#each caps as key}
                          <span class="tag-chip-default text-[0.6rem] px-1.5 py-0.5">
                            {CAPABILITY_META[key]?.label ?? key}
                          </span>
                        {/each}
                      </div>
                    {/if}
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    {#if update?.updateAvailable}
                      <button
                        onclick={() => void handlePluginUpdate(plugin)}
                        disabled={updatingPluginId === plugin.id}
                        class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-status-success-text hover:text-text-primary transition-colors duration-fast disabled:opacity-40"
                      >
                        {#if updatingPluginId === plugin.id}
                          <Loader2 class="h-3.5 w-3.5 animate-spin" />
                        {:else}
                          <Download class="h-3.5 w-3.5" />
                        {/if}
                        Update
                      </button>
                    {/if}
                    <button
                      onclick={() => void handlePluginToggle(plugin)}
                      class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs transition-colors duration-fast text-text-muted hover:text-text-primary"
                    >
                      {#if plugin.enabled}
                        <ToggleRight class="h-4 w-4 text-text-accent" />Disable
                      {:else}
                        <ToggleLeft class="h-4 w-4" />Enable
                      {/if}
                    </button>
                    <button
                      onclick={() => void handlePluginRemove(plugin)}
                      class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-text-muted hover:text-status-error-text transition-colors duration-fast"
                    >
                      <Trash2 class="h-3.5 w-3.5" />Remove
                    </button>
                  </div>
                </div>
              </div>
            {/each}
            {#each filteredInstalled as pkg (pkg.id)}
              {@const caps = enabledCaps(pkg.capabilities as Record<string, boolean> | null)}
              <div class={"surface-card no-lift p-4 transition-opacity duration-fast " + (pkg.enabled ? "" : "opacity-60")}>
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2.5 flex-wrap">
                      <p class="text-sm font-semibold">{pkg.name}</p>
                      <span class={"tag-chip text-[0.55rem] " + (pkg.isNsfw ? "tag-chip-default" : "tag-chip-accent")}>
                        {pkg.isNsfw ? "Stash" : "Obscura"}
                      </span>
                      {#if pkg.isNsfw}
                        <span class="tag-chip text-[0.55rem] bg-status-error/10 text-status-error-text border border-status-error/20">NSFW</span>
                      {/if}
                      <Badge variant={pkg.enabled ? "accent" : "default"}>
                        {#snippet children()}{pkg.enabled ? "Enabled" : "Disabled"}{/snippet}
                      </Badge>
                    </div>
                    <p class="text-mono-sm text-text-disabled mt-0.5">{pkg.packageId}</p>
                    {#if caps.length > 0}
                      <div class="flex flex-wrap items-center gap-1.5 mt-2.5">
                        {#each caps as key}
                          <span class={"text-[0.6rem] px-1.5 py-0.5 " + (CAPABILITY_META[key]?.category === "performer" ? "bg-accent-950/80 text-text-accent border border-border-accent/30" : "tag-chip-default")}>
                            {CAPABILITY_META[key]?.label ?? key}
                          </span>
                        {/each}
                      </div>
                    {/if}
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <button
                      onclick={() => void handleToggle(pkg)}
                      class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs transition-colors duration-fast text-text-muted hover:text-text-primary"
                    >
                      {#if pkg.enabled}
                        <ToggleRight class="h-4 w-4 text-text-accent" />Disable
                      {:else}
                        <ToggleLeft class="h-4 w-4" />Enable
                      {/if}
                    </button>
                    <button
                      onclick={() => void handleUninstall(pkg)}
                      class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-text-muted hover:text-status-error-text transition-colors duration-fast"
                    >
                      <Trash2 class="h-3.5 w-3.5" />Remove
                    </button>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </section>
    {/if}

    <!-- OBSCURA COMMUNITY INDEX TAB -->
    {#if tab === "obscura-index"}
      <section class="space-y-3">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <p class="text-text-muted text-[0.72rem]">
            {obscuraEntries.length} plugins available
            {#if isSfw && obscuraEntries.some((e) => e.isNsfw)}
              · {obscuraEntries.filter((e) => e.isNsfw).length} NSFW plugins hidden
            {/if}
          </p>
          <div class="flex items-center gap-2">
            <div class="relative">
              <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-disabled" />
              <input
                class="control-input pl-8 w-64 py-1.5 text-sm"
                placeholder="Filter by name or ID..."
                bind:value={obscuraSearch}
              />
              {#if obscuraSearch}
                <button
                  onclick={() => (obscuraSearch = "")}
                  aria-label="Clear search"
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-text-disabled hover:text-text-muted"
                >
                  <X class="h-3 w-3" />
                </button>
              {/if}
            </div>
            <Button variant="secondary" size="sm" onclick={() => void loadObscuraIndex()} disabled={obscuraLoading}>
              {#snippet children()}
                {#if obscuraLoading}
                  <Loader2 class="h-3.5 w-3.5 animate-spin" />
                {:else}
                  <RefreshCw class="h-3.5 w-3.5" />
                {/if}
                Refresh
              {/snippet}
            </Button>
          </div>
        </div>

        {#if obscuraLoading && !obscuraLoaded}
          <div class="surface-card no-lift p-12 flex items-center justify-center">
            <Loader2 class="h-6 w-6 animate-spin text-text-muted" />
          </div>
        {:else if filteredObscura.length === 0}
          <div class="surface-card no-lift p-8 text-center">
            <Sparkles class="h-8 w-8 text-text-disabled mx-auto mb-3" />
            <p class="text-text-muted text-sm">
              {obscuraSearch
                ? "No plugins match your search."
                : obscuraLoaded
                  ? "No plugins available."
                  : "Loading plugin index..."}
            </p>
            {#if !obscuraLoaded && !obscuraLoading}
              <p class="text-text-disabled text-xs mt-2">
                Set <code class="font-mono text-text-muted">OBSCURA_PLUGIN_INDEX_PATH</code> to point to the community plugins repo.
              </p>
            {/if}
          </div>
        {:else}
          <div class="space-y-1">
            {#each filteredObscura as entry (entry.id)}
              <div class="surface-card no-lift px-4 py-3 flex items-center gap-3">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <p class="text-sm font-medium">{entry.name}</p>
                    <span class="tag-chip tag-chip-accent text-[0.55rem]">Obscura</span>
                    {#if entry.isNsfw}
                      <span class="tag-chip text-[0.55rem] bg-status-error/10 text-status-error-text border border-status-error/20">NSFW</span>
                    {/if}
                    <span class="text-mono-sm text-text-disabled">v{entry.version}</span>
                  </div>
                  {#if entry.description}
                    <p class="text-text-muted text-[0.68rem] mt-0.5">{entry.description}</p>
                  {/if}
                  <div class="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {#each enabledCaps(entry.capabilities) as key}
                      <span class="tag-chip-default text-[0.55rem] px-1.5 py-0.5">
                        {CAPABILITY_META[key]?.label ?? key}
                      </span>
                    {/each}
                  </div>
                </div>
                {#if entry.installed}
                  <Badge variant="accent">
                    {#snippet children()}<Check class="h-2.5 w-2.5 mr-1" />Installed{/snippet}
                  </Badge>
                {:else}
                  <button
                    onclick={() => void handleObscuraInstall(entry)}
                    disabled={obscuraInstallingId === entry.id}
                    class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-text-muted hover:text-text-accent transition-colors duration-fast shrink-0 disabled:opacity-40"
                  >
                    {#if obscuraInstallingId === entry.id}
                      <Loader2 class="h-3.5 w-3.5 animate-spin" />
                    {:else}
                      <Download class="h-3.5 w-3.5" />
                    {/if}
                    Install
                  </button>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </section>
    {/if}

    <!-- STASH COMMUNITY INDEX TAB -->
    {#if tab === "stash-index" && !isSfw}
      <section class="space-y-3">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <p class="text-text-muted text-[0.72rem]">
            {indexEntries.length} scrapers available · All Stash community scrapers are classified as NSFW
          </p>
          <div class="flex items-center gap-2">
            <div class="relative">
              <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-disabled" />
              <input
                class="control-input pl-8 w-64 py-1.5 text-sm"
                placeholder="Filter by name or ID..."
                bind:value={indexSearch}
              />
              {#if indexSearch}
                <button
                  onclick={() => (indexSearch = "")}
                  aria-label="Clear search"
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-text-disabled hover:text-text-muted"
                >
                  <X class="h-3 w-3" />
                </button>
              {/if}
            </div>
            <Button variant="secondary" size="sm" onclick={() => void loadStashIndex(true)} disabled={indexLoading}>
              {#snippet children()}
                {#if indexLoading}
                  <Loader2 class="h-3.5 w-3.5 animate-spin" />
                {:else}
                  <RefreshCw class="h-3.5 w-3.5" />
                {/if}
                Refresh
              {/snippet}
            </Button>
          </div>
        </div>

        {#if indexLoading && !indexLoaded}
          <div class="surface-card no-lift p-12 flex items-center justify-center">
            <Loader2 class="h-6 w-6 animate-spin text-text-muted" />
          </div>
        {:else}
          <div class="space-y-1 max-h-[600px] overflow-y-auto scrollbar-hidden">
            {#each filteredIndex as entry (entry.id)}
              <div class="surface-card no-lift px-4 py-3 flex items-center gap-3">
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium">{entry.name}</p>
                  <p class="text-text-disabled text-[0.65rem] mt-0.5 font-mono">
                    {entry.id}
                    <span class="text-text-disabled/60 ml-2">{entry.date}</span>
                    {#if entry.requires?.length}
                      <span class="text-text-disabled/60 ml-2">requires: {entry.requires.join(", ")}</span>
                    {/if}
                  </p>
                </div>
                {#if entry.installed}
                  <Badge variant="accent">
                    {#snippet children()}<Check class="h-2.5 w-2.5 mr-1" />Installed{/snippet}
                  </Badge>
                {:else}
                  <button
                    onclick={() => void handleInstall(entry.id)}
                    disabled={installingId === entry.id}
                    class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-text-muted hover:text-text-accent transition-colors duration-fast shrink-0 disabled:opacity-40"
                  >
                    {#if installingId === entry.id}
                      <Loader2 class="h-3.5 w-3.5 animate-spin" />
                    {:else}
                      <Download class="h-3.5 w-3.5" />
                    {/if}
                    Install
                  </button>
                {/if}
              </div>
            {/each}
            {#if filteredIndex.length === 0}
              <div class="surface-card no-lift p-8 text-center">
                <p class="text-text-muted text-sm">
                  {indexSearch ? "No scrapers match your search." : "Index is empty."}
                </p>
              </div>
            {/if}
          </div>
        {/if}
      </section>
    {/if}

    <!-- STASHBOX ENDPOINTS TAB -->
    {#if tab === "stashbox" && !isSfw}
      <section class="space-y-2">
        <div class="flex items-center justify-between px-1">
          <p class="text-text-muted text-[0.72rem]">
            Connect to StashDB, ThePornDB, FansDB, and other Stash-Box protocol servers
          </p>
          <Button
            variant="ghost"
            size="sm"
            onclick={openAddStashBox}
            class="h-auto gap-1 px-2 py-1 text-[0.68rem] text-text-accent hover:bg-accent-950/60"
          >
            {#snippet children()}<Plus class="h-3 w-3" />Add Endpoint{/snippet}
          </Button>
        </div>

        {#if stashBoxEndpoints.length === 0 && !showStashBoxForm}
          <div class="empty-rack-slot p-6 text-center">
            <Plug class="h-8 w-8 text-text-disabled mx-auto mb-3" />
            <p class="text-[0.75rem] text-text-disabled">
              No endpoints configured. Add one to enable fingerprint-based identification.
            </p>
          </div>
        {/if}

        {#each stashBoxEndpoints as ep (ep.id)}
          {@const tr = sbTestResult}
          <div class="surface-card no-lift p-3.5">
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-[0.82rem] font-medium truncate">{ep.name}</span>
                  <span class="tag-chip text-[0.55rem] bg-status-error/10 text-status-error-text border border-status-error/20">NSFW</span>
                  {#if !ep.enabled}
                    <Badge>
                      {#snippet children()}Disabled{/snippet}
                    </Badge>
                  {/if}
                  {#if tr && tr.id === ep.id}
                    <Badge variant={tr.valid ? "success" : "error"}>
                      {#snippet children()}
                        {#if tr.valid}
                          <Check class="h-2.5 w-2.5" />Connected
                        {:else}
                          <AlertCircle class="h-2.5 w-2.5" />{tr.error ?? "Failed"}
                        {/if}
                      {/snippet}
                    </Badge>
                  {/if}
                </div>
                <p class="text-[0.65rem] text-text-disabled truncate mt-0.5">
                  {ep.endpoint} · Key: {ep.apiKeyPreview}
                </p>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <button
                  onclick={() => void testEndpoint(ep)}
                  disabled={sbTesting === ep.id}
                  aria-label="Test connection"
                  class="p-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary"
                >
                  {#if sbTesting === ep.id}
                    <Loader2 class="h-3.5 w-3.5 animate-spin text-accent-400" />
                  {:else}
                    <RefreshCw class="h-3.5 w-3.5" />
                  {/if}
                </button>
                <button
                  onclick={() => openEditStashBox(ep)}
                  aria-label="Edit"
                  class="p-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary"
                >
                  <Pencil class="h-3.5 w-3.5" />
                </button>
                <button
                  onclick={() => void toggleEndpointEnabled(ep)}
                  aria-label={ep.enabled ? "Disable" : "Enable"}
                  class="p-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary"
                >
                  {#if ep.enabled}
                    <ToggleRight class="h-3.5 w-3.5 text-text-accent" />
                  {:else}
                    <ToggleLeft class="h-3.5 w-3.5" />
                  {/if}
                </button>
                <button
                  onclick={() => void deleteEndpoint(ep)}
                  aria-label="Remove"
                  class="p-1.5 text-text-muted transition-colors hover:bg-status-error/10 hover:text-status-error-text"
                >
                  <Trash2 class="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        {/each}

        {#if showStashBoxForm}
          <div class="surface-well space-y-3 border border-border-accent/30 p-4">
            <div class="flex items-center justify-between">
              <h4 class="text-[0.78rem] font-medium">
                {editingStashBox ? "Edit Endpoint" : "Add Stash-Box Endpoint"}
              </h4>
              <button
                onclick={() => (showStashBoxForm = false)}
                aria-label="Close"
                class="p-1 text-text-disabled transition-colors hover:text-text-muted"
              >
                <X class="h-3.5 w-3.5" />
              </button>
            </div>
            <div class="grid gap-2.5">
              <div>
                <label for="sb-name" class="text-[0.65rem] text-text-disabled block mb-1">Name</label>
                <input
                  id="sb-name"
                  type="text"
                  bind:value={sbName}
                  placeholder="StashDB"
                  class="w-full bg-surface-1 border border-border-subtle px-2.5 py-1.5 text-[0.78rem] text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-border-accent transition-colors"
                />
              </div>
              <div>
                <label for="sb-endpoint" class="text-[0.65rem] text-text-disabled block mb-1">GraphQL Endpoint</label>
                <input
                  id="sb-endpoint"
                  type="text"
                  bind:value={sbEndpoint}
                  placeholder="https://stashdb.org/graphql"
                  class="w-full bg-surface-1 border border-border-subtle px-2.5 py-1.5 text-[0.78rem] text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-border-accent transition-colors"
                />
                <div class="flex gap-1.5 mt-1.5 flex-wrap">
                  {#each [{ label: "StashDB", url: "https://stashdb.org/graphql" }, { label: "FansDB", url: "https://fansdb.cc/graphql" }, { label: "PMVStash", url: "https://pmvstash.org/graphql" }, { label: "ThePornDB", url: "https://theporndb.net/graphql" }] as preset}
                    <button
                      onclick={() => {
                        sbEndpoint = preset.url;
                        if (!sbName) sbName = preset.label;
                      }}
                      class="border border-border-subtle px-1.5 py-0.5 text-[0.6rem] text-text-disabled transition-colors hover:border-border-default hover:text-text-muted"
                    >
                      {preset.label}
                    </button>
                  {/each}
                </div>
              </div>
              <div>
                <label for="sb-apikey" class="text-[0.65rem] text-text-disabled block mb-1">
                  API Key
                  {#if editingStashBox}
                    <span class="text-text-disabled">(leave blank to keep current)</span>
                  {/if}
                </label>
                <input
                  id="sb-apikey"
                  type="password"
                  bind:value={sbApiKey}
                  placeholder={editingStashBox ? "••••••••" : "Paste your API key"}
                  class="w-full bg-surface-1 border border-border-subtle px-2.5 py-1.5 text-[0.78rem] text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-border-accent transition-colors font-mono"
                />
              </div>
            </div>
            <div class="flex items-center justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onclick={() => (showStashBoxForm = false)} class="h-auto px-3 py-1.5 text-[0.72rem]">
                {#snippet children()}Cancel{/snippet}
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={sbSaving || !sbName || !sbEndpoint}
                onclick={() => void saveStashBox()}
                class="h-auto gap-1.5 px-3 py-1.5 text-[0.72rem]"
              >
                {#snippet children()}
                  {#if sbSaving}
                    <Loader2 class="h-3 w-3 animate-spin" />
                  {:else}
                    <Save class="h-3 w-3" />
                  {/if}
                  {editingStashBox ? "Update" : "Save"}
                {/snippet}
              </Button>
            </div>
          </div>
        {/if}
      </section>
    {/if}
  {/if}
</div>
