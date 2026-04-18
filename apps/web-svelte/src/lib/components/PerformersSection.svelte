<script lang="ts">
  import { User, Star } from "@lucide/svelte";
  import { toApiUrl } from "$lib/api/core";
  import NsfwBlur from "./NsfwBlur.svelte";
  import { entityTerms } from "$lib/terminology";

  export interface PerformerEmbed {
    id: string;
    name: string;
    imagePath?: string | null;
    gender?: string | null;
    favorite?: boolean;
    isNsfw?: boolean;
    character?: string | null;
    roleSource?: "episode" | "series" | "movie" | null;
  }

  interface Props {
    performers: PerformerEmbed[];
    parentIsNsfw?: boolean;
    headingLabel?: string;
  }

  let { performers, parentIsNsfw = false, headingLabel }: Props = $props();

  const heading = $derived(headingLabel ?? entityTerms.performers);

  function initials(name: string): string {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }
</script>

<section>
  <h4 class="text-kicker mb-3 flex items-center gap-2">
    <User class="h-3.5 w-3.5" />
    {heading}
  </h4>
  {#if performers.length === 0}
    <p class="text-text-disabled text-sm">No {heading.toLowerCase()} tagged</p>
  {:else}
    <div class="flex flex-wrap gap-2">
      {#each performers as p (p.id)}
        {@const imgUrl = toApiUrl(p.imagePath)}
        <a
          href={`/performers/${p.id}`}
          class="surface-card-sharp flex items-center gap-3 p-2.5 pr-4 hover:border-border-accent transition-colors"
        >
          <NsfwBlur
            isNsfw={parentIsNsfw || (p.isNsfw ?? false)}
            class="flex-shrink-0 h-12 w-9 overflow-hidden bg-surface-3 border border-border-subtle"
          >
            <div class="h-12 w-9 overflow-hidden bg-surface-3">
              {#if imgUrl}
                <img src={imgUrl} alt={p.name} class="w-full h-full object-cover" loading="lazy" />
              {:else}
                <div
                  class="w-full h-full flex items-center justify-center text-[0.6rem] font-mono font-medium text-text-muted"
                >
                  {initials(p.name)}
                </div>
              {/if}
            </div>
          </NsfwBlur>
          <div>
            <p class="text-sm font-medium text-text-primary">{p.name}</p>
            <div class="mt-0.5 space-y-1">
              {#if p.character || p.gender || p.favorite || p.roleSource}
                <div class="flex flex-wrap items-center gap-2">
                  {#if p.character}
                    <span class="text-xs text-text-muted">as {p.character}</span>
                  {/if}
                  {#if p.roleSource}
                    <span class="bg-surface-3 px-1 py-0.5 text-[0.6rem] uppercase tracking-[0.12em] text-text-disabled">
                      {p.roleSource}
                    </span>
                  {/if}
                </div>
              {/if}
              <div class="flex items-center gap-2">
                {#if p.gender}
                  <span class="text-xs text-text-disabled capitalize">{p.gender}</span>
                {/if}
                {#if p.favorite}
                  <Star class="h-3 w-3 fill-accent-500 text-accent-500" />
                {/if}
              </div>
            </div>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</section>
