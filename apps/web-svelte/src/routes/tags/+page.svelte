<script lang="ts">
  import { Plus, Tag as TagIcon } from "@lucide/svelte";
  import { Button } from "@obscura/ui-svelte";

  let { data } = $props();
</script>

<svelte:head>
  <title>Tags — Obscura</title>
</svelte:head>

<div class="space-y-6">
  <header class="flex items-center justify-between gap-4">
    <div>
      <p class="text-kicker text-text-muted">Browse</p>
      <h1 class="text-h1 text-text-primary">Tags</h1>
      <p class="text-body text-text-muted mt-1">
        {data.tags.length} tag{data.tags.length === 1 ? "" : "s"}
      </p>
    </div>
    <a href="/tags/new">
      <Button variant="primary" size="md">
        <Plus class="h-4 w-4" />
        New tag
      </Button>
    </a>
  </header>

  {#if data.tags.length === 0}
    <div class="surface-panel p-8 text-center">
      <TagIcon class="h-10 w-10 mx-auto mb-3 text-text-disabled" />
      <p class="text-body text-text-muted">No tags yet.</p>
      <p class="text-body-sm text-text-disabled mt-1">
        Tags you create from the Identify or Edit flows will appear here.
      </p>
    </div>
  {:else}
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {#each data.tags as tag (tag.id)}
        <a
          href={`/tags/${tag.id}`}
          class="surface-card-sharp p-3 flex flex-col gap-2 hover:border-border-accent transition-colors duration-fast"
        >
          <div class="flex items-center gap-2">
            <TagIcon class="h-4 w-4 text-accent-500 shrink-0" />
            <span class="truncate text-body font-medium text-text-primary">{tag.name}</span>
          </div>
          {#if tag.aliases && tag.aliases.length > 0}
            <div class="flex flex-wrap gap-1">
              {#each tag.aliases.slice(0, 3) as alias}
                <span class="tag-chip tag-chip-default text-[0.6rem]">{alias}</span>
              {/each}
              {#if tag.aliases.length > 3}
                <span class="text-[0.6rem] text-text-disabled">+{tag.aliases.length - 3}</span>
              {/if}
            </div>
          {/if}
        </a>
      {/each}
    </div>
  {/if}
</div>
