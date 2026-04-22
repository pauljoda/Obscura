<script lang="ts">
  import { goto, invalidate } from "$app/navigation";
  import {
    ChevronLeft,
    FolderOpen,
    Save,
    Loader2,
    Hand,
    Zap,
    Shuffle,
  } from "@lucide/svelte";
  import type {
    CollectionDetailDto,
    CollectionMode,
    CollectionRuleGroup,
    CollectionPatchDto,
    CollectionCreateDto,
  } from "@obscura/contracts";
  import { Button } from "@obscura/ui-svelte";
  import { createCollection, updateCollection } from "$lib/api/media";
  import ConditionBuilder from "./collections/ConditionBuilder.svelte";
  import type { SuggestionItem } from "$lib/collection-suggestions";

  interface Props {
    collection?: CollectionDetailDto;
    isNew?: boolean;
    availableTags?: SuggestionItem[];
    availablePerformers?: SuggestionItem[];
    availableStudios?: SuggestionItem[];
  }

  let {
    collection,
    isNew = false,
    availableTags = [],
    availablePerformers = [],
    availableStudios = [],
  }: Props = $props();

  const modeOptions: {
    value: CollectionMode;
    label: string;
    description: string;
    icon: typeof Hand;
  }[] = [
    {
      value: "manual",
      label: "Manual",
      description: "Manually curated items only. Add content from any entity page.",
      icon: Hand,
    },
    {
      value: "dynamic",
      label: "Dynamic",
      description: "Auto-populate based on rules. Manual additions are always preserved.",
      icon: Zap,
    },
    {
      value: "hybrid",
      label: "Hybrid",
      description: "Dynamic rules combined with manual curation for full control.",
      icon: Shuffle,
    },
  ];

  let isSaving = $state(false);
  let saveError = $state<string | null>(null);

  let name = $state("New Collection");
  let description = $state("");
  let mode = $state<CollectionMode>("manual");
  let ruleTree = $state<CollectionRuleGroup | null>(null);
  let slideshowDuration = $state(5);
  let slideshowAutoAdvance = $state(true);

  $effect(() => {
    name = collection?.name ?? "New Collection";
    description = collection?.description ?? "";
    mode = collection?.mode ?? "manual";
    ruleTree = collection?.ruleTree ?? null;
    slideshowDuration = collection?.slideshowDurationSeconds ?? 5;
    slideshowAutoAdvance = collection?.slideshowAutoAdvance ?? true;
  });

  async function handleSave() {
    isSaving = true;
    saveError = null;
    try {
      let targetId: string | null = null;
      if (isNew) {
        const dto: CollectionCreateDto = {
          name,
          description: description || undefined,
          mode,
          ruleTree: mode !== "manual" ? (ruleTree ?? undefined) : undefined,
          slideshowDurationSeconds: slideshowDuration,
          slideshowAutoAdvance,
        };
        const result = await createCollection(dto);
        targetId = result.id;
      } else if (collection) {
        const dto: CollectionPatchDto = {
          name,
          description: description || null,
          mode,
          ruleTree: mode !== "manual" ? ruleTree : null,
          slideshowDurationSeconds: slideshowDuration,
          slideshowAutoAdvance,
        };
        await updateCollection(collection.id, dto);
        targetId = collection.id;
      }

      if (targetId) {
        await invalidate(`collections:${targetId}`);
        await goto(`/collections/${targetId}`);
      } else {
        isSaving = false;
      }
    } catch (err) {
      console.error("Save failed:", err);
      saveError = err instanceof Error ? err.message : "Failed to save collection";
      isSaving = false;
    }
  }
</script>

<div class="space-y-6">
  <a
    href={collection ? `/collections/${collection.id}` : "/collections"}
    class="inline-flex items-center gap-1 text-[0.78rem] text-text-muted hover:text-text-secondary transition-colors duration-fast"
  >
    <ChevronLeft class="h-3.5 w-3.5" />
    {collection ? collection.name : "Collections"}
  </a>

  <div class="flex items-center justify-between">
    <h1 class="flex items-center gap-2.5">
      <FolderOpen class="h-5 w-5 text-text-accent" />
      {isNew ? "New Collection" : "Edit Collection"}
    </h1>
    <Button onclick={() => void handleSave()} disabled={isSaving || !name.trim()}>
      {#snippet children()}
        {#if isSaving}
          <Loader2 class="h-4 w-4 animate-spin" />
        {:else}
          <Save class="h-4 w-4" />
        {/if}
        {isNew ? "Create" : "Save"}
      {/snippet}
    </Button>
  </div>

  {#if saveError}
    <div class="px-3 py-2 border border-error/20 bg-error-muted/30 text-[0.78rem] text-error-text">
      {saveError}
    </div>
  {/if}

  <div class="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
    <div class="space-y-6">
      <section class="surface-well p-4 space-y-4">
        <h2 class="text-sm font-heading font-medium text-text-secondary">Details</h2>
        <div class="space-y-3">
          <div>
            <label class="block text-[0.75rem] font-medium text-text-muted mb-1" for="col-name">Name</label>
            <input
              id="col-name"
              type="text"
              bind:value={name}
              class="w-full px-3 py-2 text-sm bg-surface-1 border border-border-default text-text-primary focus:outline-none focus:border-accent-brass/30"
            />
          </div>
          <div>
            <label class="block text-[0.75rem] font-medium text-text-muted mb-1" for="col-desc">Description</label>
            <textarea
              id="col-desc"
              bind:value={description}
              rows={3}
              class="w-full px-3 py-2 text-sm bg-surface-1 border border-border-default text-text-primary focus:outline-none focus:border-accent-brass/30 resize-none"
            ></textarea>
          </div>
        </div>
      </section>

      <section class="surface-well p-4 space-y-3">
        <h2 class="text-sm font-heading font-medium text-text-secondary">Collection Mode</h2>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {#each modeOptions as opt (opt.value)}
            {@const Icon = opt.icon}
            <button
              type="button"
              onclick={() => (mode = opt.value)}
              class={`p-3 text-left border transition-colors ${
                mode === opt.value
                  ? "border-accent-brass/30 bg-accent-brass/5"
                  : "border-border-default hover:border-border-accent"
              }`}
            >
              <div class="flex items-center gap-2 mb-1">
                <Icon class={`h-4 w-4 ${mode === opt.value ? "text-text-accent" : "text-text-muted"}`} />
                <span class={`text-sm font-medium ${mode === opt.value ? "text-text-accent" : "text-text-primary"}`}>
                  {opt.label}
                </span>
              </div>
              <p class="text-[0.7rem] text-text-muted leading-relaxed">{opt.description}</p>
            </button>
          {/each}
        </div>
      </section>

      {#if mode !== "manual"}
        <ConditionBuilder
          {ruleTree}
          onChange={(next) => (ruleTree = next)}
          {availableTags}
          {availablePerformers}
          {availableStudios}
        />
      {/if}
    </div>

    <div class="space-y-6">
      <section class="surface-well p-4 space-y-3">
        <h2 class="text-sm font-heading font-medium text-text-secondary">Slideshow</h2>
        <p class="text-[0.7rem] text-text-muted leading-relaxed">
          Controls how images display during playlist playback.
        </p>
        <div class="space-y-3">
          <div>
            <label class="block text-[0.7rem] font-medium text-text-muted mb-1" for="slide-dur">
              Image Duration (seconds)
            </label>
            <input
              id="slide-dur"
              type="number"
              min="1"
              max="120"
              bind:value={slideshowDuration}
              oninput={(e) => {
                const v = Number((e.currentTarget as HTMLInputElement).value);
                slideshowDuration = Math.max(1, Math.min(120, v));
              }}
              class="w-full px-2 py-1.5 text-sm bg-surface-1 border border-border-default text-text-primary focus:outline-none focus:border-accent-brass/30"
            />
          </div>
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={slideshowAutoAdvance}
              class="accent-[#c49a5a]"
            />
            <span class="text-[0.78rem] text-text-secondary">Auto-advance</span>
          </label>
        </div>
      </section>

      {#if collection}
        <section class="surface-well p-4 space-y-2">
          <h2 class="text-sm font-heading font-medium text-text-secondary">Collection Info</h2>
          <div class="space-y-1 text-[0.75rem]">
            <div class="flex justify-between text-text-muted">
              <span>Items</span>
              <span class="font-mono text-text-secondary">{collection.itemCount}</span>
            </div>
            <div class="flex justify-between text-text-muted">
              <span>Created</span>
              <span class="font-mono text-text-secondary">
                {new Date(collection.createdAt).toLocaleDateString()}
              </span>
            </div>
            {#if collection.lastRefreshedAt}
              <div class="flex justify-between text-text-muted">
                <span>Last Refresh</span>
                <span class="font-mono text-text-secondary">
                  {new Date(collection.lastRefreshedAt).toLocaleDateString()}
                </span>
              </div>
            {/if}
          </div>
        </section>
      {/if}
    </div>
  </div>
</div>
