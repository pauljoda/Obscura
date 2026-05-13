<script lang="ts">
  import { Loader2, BookOpen, Film, Images, Layers, Music } from "@lucide/svelte";
  import type {
    CollectionRuleGroup,
    CollectionRulePreviewDto,
    CollectionEntityType,
  } from "@obscura/contracts";
  import { COLLECTION_RULE_FIELDS } from "@obscura/contracts";
  import ConditionGroup from "./ConditionGroup.svelte";
  import CollectionItemCard from "./CollectionItemCard.svelte";
  import { previewCollectionRules } from "$lib/v1/api/media-v1";
  import type { SuggestionItem } from "$lib/collection-suggestions";
  import { useNsfw } from "$lib/nsfw/store.svelte";

  interface Props {
    ruleTree: CollectionRuleGroup | null;
    onChange: (ruleTree: CollectionRuleGroup | null) => void;
    availableTags?: SuggestionItem[];
    availablePerformers?: SuggestionItem[];
    availableStudios?: SuggestionItem[];
  }

  let {
    ruleTree,
    onChange,
    availableTags = [],
    availablePerformers = [],
    availableStudios = [],
  }: Props = $props();

  function emptyRuleTree(): CollectionRuleGroup {
    const defaultField = COLLECTION_RULE_FIELDS[0];
    return {
      type: "group",
      operator: "and",
      children: [
        {
          type: "condition",
          entityTypes: [],
          field: defaultField.field,
          operator: defaultField.operators[0],
          value: null,
        },
      ],
    };
  }

  const typeLabels: Record<CollectionEntityType, string> = {
    video: "videos",
    gallery: "galleries",
    book: "books",
    image: "images",
    "audio-track": "audio tracks",
  };
  const typeIcons: Record<CollectionEntityType, typeof Film> = {
    video: Film,
    gallery: Images,
    book: BookOpen,
    image: Layers,
    "audio-track": Music,
  };

  let preview = $state<CollectionRulePreviewDto | null>(null);
  let isPreviewing = $state(false);
  let debounce: ReturnType<typeof setTimeout> | null = null;

  const nsfw = useNsfw();
  const tree = $derived(ruleTree ?? emptyRuleTree());

  async function runPreview(currentTree: CollectionRuleGroup) {
    isPreviewing = true;
    try {
      preview = await previewCollectionRules(currentTree, {
        nsfw: nsfw.mode === "off" ? "off" : undefined,
      });
    } catch {
      // silent
    } finally {
      isPreviewing = false;
    }
  }

  $effect(() => {
    const t = ruleTree;
    // Re-fire preview when nsfw mode toggles too.
    void nsfw.mode;
    if (!t || t.children.length === 0) {
      preview = null;
      return;
    }
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => void runPreview(t), 800);
    return () => {
      if (debounce) clearTimeout(debounce);
    };
  });
</script>

<div class="space-y-4">
  <section class="surface-well p-4">
    <div class="flex items-center justify-between mb-3">
      <h2 class="text-sm font-heading font-medium text-text-secondary">Dynamic Rules</h2>
      {#if isPreviewing}
        <span class="inline-flex items-center gap-1.5 text-[0.7rem] text-text-muted">
          <Loader2 class="h-3 w-3 animate-spin" />
          Updating preview...
        </span>
      {/if}
    </div>

    <ConditionGroup
      group={tree}
      onChange={(updated) => onChange(updated)}
      {availableTags}
      {availablePerformers}
      {availableStudios}
    />
  </section>

  {#if preview}
    <section class="surface-well p-4 space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-heading font-medium text-text-secondary">Preview</h2>
        <span class="text-[0.78rem] font-mono text-text-accent">
          {preview.total} match{preview.total !== 1 ? "es" : ""}
        </span>
      </div>

      <div class="flex flex-wrap gap-3">
        {#each Object.entries(preview.byType).filter(([, c]) => (c as number) > 0) as [type, count] (type)}
          {@const Icon = typeIcons[type as CollectionEntityType]}
          <span class="inline-flex items-center gap-1 text-[0.75rem] text-text-muted">
            <Icon class="h-3 w-3" />
            {count} {typeLabels[type as CollectionEntityType]}
          </span>
        {/each}
      </div>

      {#if preview.sample.length > 0}
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {#each preview.sample as item (item.id)}
            <CollectionItemCard {item} />
          {/each}
        </div>
      {/if}

      {#if preview.total > preview.sample.length}
        <p class="text-[0.7rem] text-text-disabled text-center">
          Showing {preview.sample.length} of {preview.total} matches
        </p>
      {/if}
    </section>
  {/if}
</div>
