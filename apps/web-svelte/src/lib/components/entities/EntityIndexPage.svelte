<script lang="ts">
  import type { Component } from "svelte";
  import { onMount } from "svelte";
  import { useNsfw } from "$lib/nsfw/store.svelte";
  import EntityGrid from "./EntityGrid.svelte";
  import { EntityIndexPageState } from "./entity-index-page.svelte";
  import type { V2EntityCard } from "$lib/api/v2";

  interface Props {
    actionHref?: string;
    actionIcon?: Component;
    actionLabel?: string;
    description: string;
    emptyMessage: string;
    emptyTitle: string;
    errorMessage?: string;
    icon: Component;
    kind: string;
    prefsKey: string;
    resolveHref?: (item: V2EntityCard) => string | undefined;
    title: string;
  }

  let {
    actionHref,
    actionIcon: ActionIcon,
    actionLabel,
    description,
    emptyMessage,
    emptyTitle,
    errorMessage,
    icon: Icon,
    kind,
    prefsKey,
    resolveHref,
    title,
  }: Props = $props();

  const nsfw = useNsfw();
  const page = new EntityIndexPageState({
    getKind: () => kind,
    getHideNsfw: () => nsfw.mode === "off",
    resolveHref: (item) => resolveHref?.(item),
  });

  let lastNsfwMode = $state(nsfw.mode);

  onMount(() => {
    void page.loadInitial();
  });

  $effect(() => {
    if (nsfw.mode !== lastNsfwMode) {
      lastNsfwMode = nsfw.mode;
      void page.loadInitial();
    }
  });
</script>

<svelte:head>
  <title>{title} · Obscura</title>
</svelte:head>

<section class="space-y-5">
  <div class="flex items-start justify-between gap-4">
    <div>
      <h1 class="flex items-center gap-2.5">
        <Icon class="h-5 w-5 text-text-accent" />
        {title}
      </h1>
      <p class="mt-1 text-[0.78rem] text-text-muted">
        {description}
      </p>
    </div>

    {#if actionHref && actionLabel}
      <a
        href={actionHref}
        class="inline-flex items-center gap-1.5 bg-accent-500 px-4 py-2 text-sm font-semibold text-accent-950 transition-all duration-normal hover:bg-accent-400 hover:shadow-[0_0_16px_rgba(196,154,90,0.3)]"
      >
        {#if ActionIcon}
          <ActionIcon class="h-4 w-4" />
        {/if}
        {actionLabel}
      </a>
    {/if}
  </div>

  {#if page.loadState === "error"}
    <div class="surface-card-sharp flex items-center justify-between gap-4 border-error-500/50 p-4">
      <p class="text-sm text-text-muted">{page.errorMessage ?? errorMessage ?? `Failed to load ${title.toLowerCase()}.`}</p>
      <button
        type="button"
        class="surface-well px-3 py-1 text-body-sm text-text-muted transition-colors hover:text-text-primary"
        onclick={() => void page.loadInitial()}
      >
        Retry
      </button>
    </div>
  {:else}
    <EntityGrid
      cards={page.cards}
      loading={page.loadState === "loading"}
      {prefsKey}
      {emptyTitle}
      {emptyMessage}
      hasMore={page.nextCursor !== null}
      loadingMore={page.loadingMore}
      loadMoreError={page.loadMoreError}
      loadMoreHref={`/${prefsKey}`}
      loadMoreKey={page.nextCursor ?? undefined}
      onLoadMore={() => page.loadMore()}
    />
  {/if}
</section>
