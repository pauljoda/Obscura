<script lang="ts">
  import { onMount } from "svelte";
  import { BookOpen } from "@lucide/svelte";
  import { fetchV2Entities, type V2EntityCard } from "$lib/api/v2";
  import { entityCardToThumbnailCard } from "$lib/entities/entity-grid";
  import { resolveEntityHref } from "$lib/entities/entity-routes";
  import type { EntityThumbnailCard } from "$lib/entities/entity-thumbnail";
  import { useNsfw } from "$lib/nsfw/store.svelte";
  import EntityGrid from "$lib/components/entities/EntityGrid.svelte";
  import InfiniteLoadTrigger from "$lib/components/entities/InfiniteLoadTrigger.svelte";

  type LoadState = "loading" | "ready" | "error";

  const nsfw = useNsfw();

  let loadState: LoadState = $state("loading");
  let items: V2EntityCard[] = $state.raw([]);
  let nextCursor: string | null = $state(null);
  let errorMessage: string | null = $state(null);
  let loadingMore = $state(false);
  let loadMoreError: string | null = $state(null);

  const cards: EntityThumbnailCard[] = $derived(
    items.map((item) => entityCardToThumbnailCard(item, resolveEntityHref(item.kind, item.id))),
  );

  let lastNsfwMode = $state(nsfw.mode);

  onMount(() => {
    void loadInitial();
  });

  $effect(() => {
    if (nsfw.mode !== lastNsfwMode) {
      lastNsfwMode = nsfw.mode;
      void loadInitial();
    }
  });

  async function loadInitial() {
    loadState = "loading";
    errorMessage = null;
    items = [];
    nextCursor = null;

    try {
      const response = await fetchV2Entities({ kind: "book", hideNsfw: nsfw.mode === "off" });
      items = response.items;
      nextCursor = response.nextCursor;
      loadState = "ready";
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      loadState = "error";
    }
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    loadingMore = true;
    loadMoreError = null;

    try {
      const response = await fetchV2Entities({
        kind: "book",
        cursor: nextCursor,
        hideNsfw: nsfw.mode === "off",
      });
      items = [...items, ...response.items];
      nextCursor = response.nextCursor;
    } catch (err) {
      loadMoreError = err instanceof Error ? err.message : String(err);
    } finally {
      loadingMore = false;
    }
  }
</script>

<svelte:head>
  <title>Books · Obscura</title>
</svelte:head>

<section class="space-y-5">
  <div>
    <h1 class="flex items-center gap-2.5">
      <BookOpen class="h-5 w-5 text-text-accent" />
      Books
    </h1>
    <p class="mt-1 text-[0.78rem] text-text-muted">
      Browse comics and books in your library
    </p>
  </div>

  {#if loadState === "error"}
    <div class="surface-card-sharp flex items-center justify-between gap-4 p-4 border-error-500/50">
      <p class="text-sm text-text-muted">{errorMessage ?? "Failed to load books."}</p>
      <button
        type="button"
        class="surface-well px-3 py-1 text-body-sm text-text-muted hover:text-text-primary transition-colors"
        onclick={() => void loadInitial()}
      >
        Retry
      </button>
    </div>
  {:else}
    <EntityGrid
      {cards}
      loading={loadState === "loading"}
      prefsKey="books"
      emptyTitle="No books"
      emptyMessage="No books in your library yet. Add a library root and scan to get started."
    />

    <InfiniteLoadTrigger
      hasMore={nextCursor !== null}
      loading={loadingMore}
      error={loadMoreError}
      nextHref="/books"
      loadKey={nextCursor ?? undefined}
      onLoad={loadMore}
    />
  {/if}
</section>
