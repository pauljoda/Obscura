<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { Search as SearchIcon, Loader } from "@lucide/svelte";
  import { Badge } from "@obscura/ui-svelte";
  import { fetchSearch } from "$lib/api/media";
  import { toApiUrl } from "$lib/api/core";
  import type { EntityKind, SearchResponseDto } from "@obscura/contracts";

  let q = $state(page.url.searchParams.get("q") ?? "");
  const kindsParam = page.url.searchParams.get("kinds");
  const kinds: EntityKind[] = kindsParam
    ? (kindsParam.split(",") as EntityKind[])
    : ([] as EntityKind[]);

  let loading = $state(false);
  let error = $state<string | null>(null);
  let results = $state<SearchResponseDto | null>(null);

  async function runSearch(term: string) {
    if (!term.trim()) {
      results = null;
      return;
    }
    loading = true;
    error = null;
    try {
      results = await fetchSearch({
        q: term.trim(),
        kinds: kinds.length > 0 ? kinds : undefined,
        limit: 40,
      });
    } catch (err) {
      error = err instanceof Error ? err.message : "Search failed";
      results = null;
    } finally {
      loading = false;
    }
  }

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (kinds.length > 0) params.set("kinds", kinds.join(","));
    void goto(`/search${params.toString() ? `?${params.toString()}` : ""}`, { keepFocus: true });
    void runSearch(q);
  }

  $effect(() => {
    const initial = page.url.searchParams.get("q") ?? "";
    if (initial) void runSearch(initial);
  });

  function entityHref(kind: EntityKind, id: string, name?: string): string {
    switch (kind) {
      case "video":
        return `/videos/${id}`;
      case "gallery":
        return `/galleries/${id}`;
      case "image":
        return `/images/${id}`;
      case "audio_library":
        return `/audio/${id}`;
      case "audio_track":
        return `/audio/tracks/${id}`;
      case "collection":
        return `/collections/${id}`;
      case "performer":
        return `/performers/${id}`;
      case "studio":
        return name ? `/studios/${encodeURIComponent(name)}` : "/studios";
      case "tag":
        return name ? `/tags/${encodeURIComponent(name)}` : "/tags";
      default:
        return "/";
    }
  }
</script>

<svelte:head>
  <title>Search — Obscura</title>
</svelte:head>

<div class="space-y-6">
  <header class="space-y-3">
    <div>
      <p class="text-kicker text-text-muted">Overview</p>
      <h1 class="text-h1 text-text-primary">Search</h1>
    </div>
    <form onsubmit={handleSubmit} class="relative max-w-xl">
      <SearchIcon class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-disabled" />
      <input
        type="search"
        bind:value={q}
        placeholder="Search across videos, galleries, performers, tags…"
        autofocus
        class="w-full bg-surface-2 border border-border-default pl-9 pr-3 py-2 text-body text-text-primary focus:border-border-accent outline-none transition-colors duration-fast"
      />
    </form>
  </header>

  {#if loading}
    <div class="flex items-center gap-2 text-body-sm text-text-muted">
      <Loader class="h-4 w-4 animate-spin" /> Searching…
    </div>
  {:else if error}
    <div class="surface-panel border-error/30 p-3 text-body-sm text-error-text">{error}</div>
  {:else if results}
    {@const groups = results.groups ?? []}
    {#if groups.length === 0}
      <div class="surface-panel p-5 text-body text-text-muted">No matches.</div>
    {:else}
      {#each groups as group (group.kind)}
        <section class="space-y-2">
          <h2 class="text-label text-text-muted capitalize">
            {group.kind.replaceAll("_", " ")} ({group.total})
          </h2>
          <ul class="surface-panel divide-y divide-border-subtle">
            {#each group.items as item (item.id)}
              <li>
                <a
                  href={entityHref(group.kind, item.id, item.name)}
                  class="flex items-center gap-3 px-4 py-2 text-body-sm hover:bg-surface-2 transition-colors duration-fast"
                >
                  {#if item.thumbnailPath}
                    <img
                      src={toApiUrl(item.thumbnailPath)}
                      alt=""
                      loading="lazy"
                      class="h-8 w-12 object-cover shrink-0"
                    />
                  {/if}
                  <span class="flex-1 min-w-0 truncate text-text-primary">
                    {item.title ?? item.name ?? item.id}
                  </span>
                  {#if item.studioName}
                    <span class="text-text-accent truncate max-w-[200px]">{item.studioName}</span>
                  {/if}
                </a>
              </li>
            {/each}
          </ul>
        </section>
      {/each}
    {/if}
  {/if}
</div>
