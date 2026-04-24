<script lang="ts">
  import { User, Star } from "@lucide/svelte";
  import PerformerThumbnail from "./PerformerThumbnail.svelte";
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
        <a
          href={`/performers/${p.id}`}
          class="surface-card-sharp flex items-center gap-3 p-2.5 pr-4 hover:border-border-accent transition-colors"
        >
          <div class="h-12 w-9 flex-shrink-0">
            <PerformerThumbnail
              performer={{
                name: p.name,
                imagePath: p.imagePath,
                favorite: p.favorite,
                isNsfw: parentIsNsfw || (p.isNsfw ?? false),
              }}
              showChips={false}
              compact
              class="h-full w-full"
            />
          </div>
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
