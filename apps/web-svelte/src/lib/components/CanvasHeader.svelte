<script lang="ts">
  import { Ellipsis, Search, Settings } from "@lucide/svelte";
  import { page } from "$app/state";
  import { cn } from "@obscura/ui-svelte";
  import { useAppChrome } from "$lib/stores/app-chrome.svelte";
  import { useSearch } from "$lib/stores/search.svelte";
  import { getCanvasHeaderBreadcrumbItems } from "./canvas-header-breadcrumbs";
  import LogoMark from "./LogoMark.svelte";

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const SEGMENT_LABELS: Record<string, string> = {
    videos: "Videos",
    performers: "Actors",
  };

  function segmentLabel(seg: string): string {
    const decoded = decodeURIComponent(seg);
    const mapped = SEGMENT_LABELS[decoded.toLowerCase()];
    if (mapped) return mapped;
    return decoded.charAt(0).toUpperCase() + decoded.slice(1);
  }

  const chrome = useAppChrome();

  const pathCrumbs = $derived.by(() => {
    const segments = page.url.pathname.split("/").filter(Boolean);
    return segments
      .filter((seg) => !UUID_RE.test(seg))
      .map((seg, i, arr) => ({
        label: segmentLabel(seg),
        href: "/" + segments.slice(0, i + 1).join("/"),
        isLast: i === arr.length - 1,
      }));
  });
  const crumbs = $derived(
    chrome.breadcrumbs.length > 0
      ? chrome.breadcrumbs.map((crumb, i) => ({
          label: crumb.label,
          href: crumb.href ?? "#",
          isLast: i === chrome.breadcrumbs.length - 1 || !crumb.href,
        }))
      : pathCrumbs,
  );
  const mobileCrumbItems = $derived(getCanvasHeaderBreadcrumbItems(crumbs));

  const search = useSearch();

  let appleMod = $state(false);
  let breadcrumbMenuOpen = $state(false);
  $effect(() => {
    appleMod = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.userAgent);
  });
  const searchShortcutKbd = $derived(appleMod ? "⌘K" : "Ctrl+K");

  function closeBreadcrumbMenu() {
    breadcrumbMenuOpen = false;
  }
</script>

<header class="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border-subtle px-5">
  <div class="flex min-w-0 flex-1 items-center gap-3">
    <a
      href="/"
      aria-label="Dashboard"
      class={cn(
        "md:hidden flex h-8 w-8 shrink-0 items-center justify-center",
        "text-text-muted hover:text-text-primary hover:bg-surface-2",
        "transition-colors duration-fast",
      )}
    >
      <LogoMark size={24} alt="" />
    </a>
    <nav class="hidden min-w-0 items-center gap-1.5 text-mono-sm sm:flex" aria-label="Breadcrumb">
      {#if crumbs.length === 0}
        <span class="truncate text-text-muted">Dashboard</span>
      {:else}
        {#each crumbs as crumb, i (crumb.href)}
          <span class="flex min-w-0 items-center gap-1.5">
            {#if i > 0}
              <span class="shrink-0 text-text-disabled">/</span>
            {/if}
            {#if crumb.isLast}
              <span class="truncate text-text-primary">{crumb.label}</span>
            {:else}
              <a
                href={crumb.href}
                class="shrink-0 text-text-muted hover:text-text-primary transition-colors duration-fast"
              >
                {crumb.label}
              </a>
            {/if}
          </span>
        {/each}
      {/if}
    </nav>
    <nav class="flex min-w-0 items-center gap-1 text-mono-sm sm:hidden" aria-label="Breadcrumb">
      {#if mobileCrumbItems.length === 0}
        <span class="truncate text-text-muted">Dashboard</span>
      {:else}
        {#each mobileCrumbItems as item, i (`${item.kind}-${i}`)}
          {#if i > 0 && mobileCrumbItems[i - 1]?.kind !== "overflow"}
            <span class="shrink-0 text-text-disabled">/</span>
          {/if}
          <span class="flex min-w-0 items-center">
            {#if item.kind === "overflow"}
              <span class="relative shrink-0">
                <button
                  type="button"
                  class={cn(
                    "flex h-7 w-7 items-center justify-center border border-border-subtle bg-glass-1 text-text-muted backdrop-blur-md",
                    "hover:text-text-primary hover:border-border-accent focus-visible:border-border-accent-strong focus-visible:shadow-focus-accent",
                    "transition-colors duration-fast outline-none",
                  )}
                  aria-label={item.label}
                  aria-haspopup="menu"
                  aria-expanded={breadcrumbMenuOpen}
                  onclick={() => (breadcrumbMenuOpen = !breadcrumbMenuOpen)}
                >
                  <Ellipsis class="h-4 w-4" />
                </button>
                {#if breadcrumbMenuOpen}
                  <div
                    class="absolute left-0 top-full z-[120] mt-2 w-[min(14rem,calc(100vw-2rem))] border border-border-default bg-glass-2 p-1 shadow-glass backdrop-blur-xl"
                    role="menu"
                  >
                    {#each item.items as crumb (crumb.href)}
                      <a
                        href={crumb.href}
                        role="menuitem"
                        class="block min-w-0 truncate px-3 py-2 text-text-muted transition-colors duration-fast hover:bg-surface-2 hover:text-text-primary focus-visible:bg-surface-2 focus-visible:text-text-primary outline-none"
                        onclick={closeBreadcrumbMenu}
                      >
                        {crumb.label}
                      </a>
                    {/each}
                  </div>
                {/if}
              </span>
            {:else if item.isLast}
              <span class="min-w-0 truncate text-text-primary">{item.label}</span>
            {:else}
              <a
                href={item.href}
                class="shrink-0 text-text-muted hover:text-text-primary transition-colors duration-fast"
              >
                {item.label}
              </a>
            {/if}
          </span>
        {/each}
      {/if}
    </nav>
  </div>

  <div class="flex items-center gap-2">
    <button
      type="button"
      onclick={() => search.openPalette()}
      class={cn(
        "group flex items-center justify-center sm:justify-between w-8 sm:w-64 px-0 sm:px-3 py-1.5",
        "bg-transparent sm:bg-surface-1 border border-transparent sm:border-border-default sm:border-t-[rgba(0,0,0,0.6)]",
        "sm:shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)]",
        "text-text-muted hover:text-text-primary sm:hover:border-border-accent focus-visible:border-border-accent-strong focus-visible:shadow-focus-accent",
        "transition-all duration-fast cursor-text select-none outline-none",
      )}
      aria-label="Open search"
      title={`Search (${searchShortcutKbd})`}
    >
      <div class="flex items-center gap-2.5">
        <Search class="h-4 w-4 sm:h-3.5 sm:w-3.5 text-text-muted sm:text-text-disabled group-hover:text-text-primary sm:group-hover:text-text-muted transition-colors duration-fast" />
        <span class="hidden sm:inline text-[0.8rem]">Search...</span>
      </div>
      <kbd class="hidden sm:inline-flex h-5 items-center border border-border-subtle px-1.5 text-[0.65rem] font-mono text-text-disabled bg-surface-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_1px_2px_rgba(0,0,0,0.2)]">
        {searchShortcutKbd}
      </kbd>
    </button>
    <a
      href="/settings"
      class="flex h-8 w-8 items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors duration-fast"
    >
      <Settings class="h-4 w-4" />
    </a>
  </div>
</header>
