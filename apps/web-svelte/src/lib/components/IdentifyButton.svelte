<script lang="ts">
  import { Loader2, ScanSearch, AlertCircle } from "@lucide/svelte";
  import { cn } from "@obscura/ui-svelte";
  import {
    executePlugin,
    fetchInstalledPlugins,
    type InstalledPlugin,
  } from "$lib/api/scrapers";
  import { fetchVideoSeriesLibraryDetail } from "$lib/api/videos";
  import { filterNsfwAware } from "$lib/hooks/nsfw-aware-providers";
  import { buildLocalSeasonsInput } from "$lib/identify/identify-video-series-runner";
  import CascadeReviewDrawer from "./identify/CascadeReviewDrawer.svelte";

  type EntityKind = "video_series" | "video_movie" | "video_episode";

  interface Props {
    entityKind: EntityKind;
    entityId: string;
    title: string;
    label?: string;
    class?: string;
  }

  let { entityKind, entityId, title, label, class: className }: Props = $props();

  const CAPABILITY_BY_KIND: Record<EntityKind, string[]> = {
    video_series: ["seriesCascade", "seriesByName", "folderByName"],
    video_movie: ["movieByName", "videoByName"],
    video_episode: ["episodeByName", "episodeByFragment", "videoByName"],
  };
  const ACTION_BY_KIND: Record<EntityKind, string[]> = {
    video_series: ["seriesCascade", "seriesByName", "folderByName"],
    video_movie: ["movieByName", "videoByName"],
    video_episode: ["episodeByName", "episodeByFragment", "videoByName"],
  };

  let plugins = $state<InstalledPlugin[]>([]);
  let loadingPlugins = $state(false);
  let open = $state(false);
  let busy = $state(false);
  let error = $state<string | null>(null);
  let drawerOpen = $state<string | null>(null);

  $effect(() => {
    if (!open || plugins.length > 0 || loadingPlugins) return;
    loadingPlugins = true;
    fetchInstalledPlugins()
      .then((list) => {
        plugins = list.filter((p) => p.enabled);
      })
      .catch((err) => {
        error = err instanceof Error ? err.message : "Failed to load plugins";
      })
      .finally(() => {
        loadingPlugins = false;
      });
  });

  const visiblePlugins = $derived(filterNsfwAware(plugins));
  const eligibleCapabilities = $derived(CAPABILITY_BY_KIND[entityKind]);
  const eligible = $derived(
    visiblePlugins.filter((p) => {
      const caps = p.capabilities ?? {};
      return eligibleCapabilities.some((key) => !!caps[key]);
    }),
  );

  const defaultLabel = $derived(
    label ??
      (entityKind === "video_movie"
        ? "Identify Movie"
        : entityKind === "video_series"
          ? "Identify Series"
          : "Re-identify"),
  );

  function actionFor(plugin: InstalledPlugin): string | null {
    const caps = plugin.capabilities ?? {};
    for (const a of ACTION_BY_KIND[entityKind]) {
      if (caps[a]) return a;
    }
    return null;
  }

  async function runPlugin(plugin: InstalledPlugin) {
    busy = true;
    error = null;
    try {
      const action = actionFor(plugin);
      if (!action) {
        throw new Error(
          `${plugin.name} does not advertise a ${entityKind} lookup capability.`,
        );
      }
      let pluginInput: Record<string, unknown> = { title, name: title };
      if (entityKind === "video_series") {
        try {
          const detail = await fetchVideoSeriesLibraryDetail(entityId);
          const extra = buildLocalSeasonsInput(detail);
          if (extra) pluginInput = { ...pluginInput, ...extra };
        } catch {
          // non-fatal
        }
      }

      const res = await executePlugin(plugin.id, action, pluginInput, {
        saveResult: true,
        entityId,
      });
      if (!res.ok) throw new Error(`${plugin.name} returned no result.`);
      const saved = res.result as { id?: string } | null;
      if (!saved?.id)
        throw new Error(`${plugin.name} did not persist a scrape result.`);
      drawerOpen = saved.id;
      open = false;
    } catch (err) {
      error = err instanceof Error ? err.message : "Identify failed";
    } finally {
      busy = false;
    }
  }

  function entityKindReadable(kind: EntityKind): string {
    if (kind === "video_movie") return "movie";
    if (kind === "video_series") return "series";
    return "episode";
  }
</script>

<div class={cn("relative", className)}>
  <button
    type="button"
    onclick={() => (open = !open)}
    disabled={busy}
    class={cn(
      "flex items-center gap-1.5 px-3 py-1.5 text-[0.72rem] font-medium transition-colors surface-card",
      "hover:border-border-accent",
      busy && "opacity-50 cursor-not-allowed",
    )}
    title={defaultLabel}
  >
    {#if busy}
      <Loader2 class="h-3.5 w-3.5 animate-spin" />
    {:else}
      <ScanSearch class="h-3.5 w-3.5" />
    {/if}
    {defaultLabel}
  </button>

  {#if open}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="fixed inset-0 z-40" onclick={() => (open = false)}></div>
    <div class="absolute right-0 top-full z-50 mt-1 w-72 surface-elevated py-2">
      <div class="px-3 pb-1 text-[0.6rem] uppercase tracking-[0.14em] text-text-muted">
        Run identify plugin
      </div>
      {#if loadingPlugins}
        <div class="flex items-center gap-2 px-3 py-2 text-[0.7rem] text-text-muted">
          <Loader2 class="h-3 w-3 animate-spin" /> Loading plugins…
        </div>
      {/if}
      {#if !loadingPlugins && eligible.length === 0}
        <div class="flex items-start gap-2 px-3 py-2 text-[0.7rem] text-text-muted">
          <AlertCircle class="h-3 w-3 flex-shrink-0" />
          <span>
            No enabled plugin supports
            <code class="font-mono text-text-accent">{entityKindReadable(entityKind)}</code>
            lookup. Install a compatible plugin and try again.
          </span>
        </div>
      {/if}
      {#if !loadingPlugins}
        {#each eligible as plugin (plugin.id)}
          <button
            type="button"
            onclick={() => void runPlugin(plugin)}
            disabled={busy}
            class="w-full px-3 py-1.5 text-left text-[0.72rem] text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors"
          >
            <div class="truncate font-medium text-text-primary">{plugin.name}</div>
            <div class="truncate text-[0.6rem] text-text-disabled">
              {actionFor(plugin) ?? "—"}
              {plugin.version ? ` · ${plugin.version}` : ""}
            </div>
          </button>
        {/each}
      {/if}
      {#if error}
        <div class="mx-3 my-2 border border-status-error/30 bg-status-error/10 px-2 py-1 text-[0.68rem] text-status-error-text">
          {error}
        </div>
      {/if}
    </div>
  {/if}
</div>

{#if drawerOpen}
  <CascadeReviewDrawer
    scrapeResultId={drawerOpen}
    {entityKind}
    {entityId}
    label={title}
    onAccepted={() => {
      drawerOpen = null;
      if (typeof window !== "undefined") window.location.reload();
    }}
    onClose={() => (drawerOpen = null)}
  />
{/if}
