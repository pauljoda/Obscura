<script lang="ts">
  import { onMount } from "svelte";
  import { FolderOpen, Plus } from "@lucide/svelte";
  import { fetchV2Entities, type V2EntityCard } from "$lib/api/v2";
  import { entityCardToThumbnailCard } from "$lib/entities/entity-grid";
  import type { EntityThumbnailCard } from "$lib/entities/entity-thumbnail";
  import { useNsfw } from "$lib/nsfw/store.svelte";
  import EntityGrid from "$lib/components/entities/EntityGrid.svelte";
  import InfiniteLoadTrigger from "$lib/v1/media-surface/pagination/InfiniteLoadTriggerV1.svelte";

  type LoadState = "loading" | "ready" | "error";

  const nsfw = useNsfw();

  let loadState: LoadState = $state("loading");
  let items: V2EntityCard[] = $state.raw([]);
  let nextCursor: string | null = $state(null);
  let errorMessage: string | null = $state(null);
  let loadingMore = $state(false);
  let loadMoreError: string | null = $state(null);

  const cards: EntityThumbnailCard[] = $derived(
    items.map((item) => entityCardToThumbnailCard(item, `/collections/${item.id}`)),
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
      const response = await fetchV2Entities({ kind: "collection", hideNsfw: nsfw.mode === "off" });
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
        kind: "collection",
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
  <title>Collections · Obscura</title>
</svelte:head>

<section class="space-y-5">
  <div class="flex items-start justify-between gap-4">
    <div>
      <h1 class="flex items-center gap-2.5">
        <FolderOpen class="h-5 w-5 text-text-accent" />
        Collections
      </h1>
      <p class="mt-1 text-[0.78rem] text-text-muted">
        Curated groupings across your media
      </p>
    </div>
    <a
      href="/collections/new"
      class="inline-flex items-center gap-1.5 bg-accent-500 hover:bg-accent-400 text-accent-950 px-4 py-2 text-sm font-semibold transition-all duration-normal hover:shadow-[0_0_16px_rgba(196,154,90,0.3)]"
    >
      <Plus class="h-4 w-4" />
      New Collection
    </a>
  </div>

  {#if loadState === "error"}
    <div class="surface-card-sharp flex items-center justify-between gap-4 p-4 border-error-500/50">
      <p class="text-sm text-text-muted">{errorMessage ?? "Failed to load collections."}</p>
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
      prefsKey="collections"
      emptyTitle="No collections"
      emptyMessage="No collections yet. Create one to group media across your library."
    />

    <InfiniteLoadTrigger
      hasMore={nextCursor !== null}
      loading={loadingMore}
      error={loadMoreError}
      nextHref="/collections"
      loadKey={nextCursor ?? undefined}
      onLoad={loadMore}
    />
  {/if}
</section>
