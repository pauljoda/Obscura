<script lang="ts" generics="">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { cn } from "@obscura/ui-svelte";
  import type { MediaSurfaceConfig } from "$lib/media-surface/config";
  import MediaSurface from "$lib/media-surface/MediaSurface.svelte";

  /**
   * One tab on a detail page. The config is built lazily so inactive
   * tabs don't pay for the fetcher closure or the prefs store. The
   * type is intentionally erased on this boundary — each tab's fetcher
   * and card stay strongly typed inside their builder, but the tab
   * registry collects mixed-T configs into one array.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AnyConfig = MediaSurfaceConfig<any, any>;

  export interface MediaTabSpec {
    id: string;
    label: string;
    /** Optional badge — typically the tab's total entity count. */
    count?: number;
    /** Lazily-built MediaSurfaceConfig for this tab. */
    build: () => AnyConfig;
    /** Optional legacy prefs key to read once and migrate from. */
    legacyPrefsKey?: string;
  }

  interface Props {
    tabs: MediaTabSpec[];
    /** Tab id selected on first render when no `?tab=` is in the URL. */
    defaultTabId?: string;
  }

  let { tabs, defaultTabId }: Props = $props();

  const tabFromUrl = $derived(page.url.searchParams.get("tab"));
  const fallbackTabId = $derived(
    defaultTabId && tabs.some((t) => t.id === defaultTabId)
      ? defaultTabId
      : tabs[0]?.id ?? "",
  );
  const activeTabId = $derived(
    (tabFromUrl && tabs.some((t) => t.id === tabFromUrl) ? tabFromUrl : null) ??
      fallbackTabId,
  );
  const activeTab = $derived(tabs.find((t) => t.id === activeTabId) ?? tabs[0]);

  // Cache built configs so re-renders don't rebuild every active tab.
  const builtConfigs = new Map<string, AnyConfig>();
  function configFor(tab: MediaTabSpec): AnyConfig {
    const cached = builtConfigs.get(tab.id);
    if (cached) return cached;
    const built = tab.build();
    builtConfigs.set(tab.id, built);
    return built;
  }

  function selectTab(id: string) {
    if (id === activeTabId) return;
    const url = new URL(page.url);
    if (id === (defaultTabId ?? tabs[0]?.id)) url.searchParams.delete("tab");
    else url.searchParams.set("tab", id);
    void goto(url, { replaceState: true, keepFocus: true, noScroll: true });
  }
</script>

<div class="space-y-3">
  <div class="flex items-center gap-1 overflow-x-auto scrollbar-hidden border-b border-border-subtle">
    {#each tabs as tab (tab.id)}
      <button
        type="button"
        onclick={() => selectTab(tab.id)}
        class={cn(
          "inline-flex shrink-0 items-center gap-1.5 px-3 py-2 text-[0.78rem] transition-colors duration-fast border-b-2",
          tab.id === activeTabId
            ? "border-border-accent text-text-accent"
            : "border-transparent text-text-muted hover:text-text-primary",
        )}
      >
        <span>{tab.label}</span>
        {#if tab.count !== undefined && tab.count > 0}
          <span class="rounded-none bg-surface-2 px-1 text-[0.62rem] text-text-muted">
            {tab.count.toLocaleString()}
          </span>
        {/if}
      </button>
    {/each}
  </div>

  {#if activeTab}
    {#key activeTab.id}
      <MediaSurface
        config={configFor(activeTab)}
        legacyPrefsKey={activeTab.legacyPrefsKey}
      />
    {/key}
  {/if}
</div>
