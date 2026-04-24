<script module lang="ts">
  export type { FilterPreset } from "$lib/filter-presets";
</script>

<script lang="ts">
  import { Bookmark, Check, Plus, Trash2, X } from "@lucide/svelte";
  import { cn } from "@obscura/ui-svelte";
  import type { FilterPreset } from "$lib/filter-presets";

  interface Props {
    presets?: FilterPreset[];
    activePresetId?: string | null;
    onApplyPreset?: (preset: FilterPreset) => void;
    onSavePreset?: (name: string) => void;
    onOverwritePreset?: (id: string) => void;
    onDeletePreset?: (id: string) => void;
  }

  let {
    presets = [],
    activePresetId = null,
    onApplyPreset,
    onSavePreset,
    onOverwritePreset,
    onDeletePreset,
  }: Props = $props();

  let open = $state(false);
  let saving = $state<"idle" | "name" | "confirm">("idle");
  let saveName = $state("");
  let nameInput: HTMLInputElement | undefined = $state();

  $effect(() => {
    if (saving === "name" && nameInput) {
      nameInput.focus();
    }
  });

  function handleSaveClick() {
    if (activePresetId) saving = "confirm";
    else {
      saving = "name";
      saveName = "";
    }
  }

  function handleConfirmSave() {
    const trimmed = saveName.trim();
    if (!trimmed) return;
    onSavePreset?.(trimmed);
    saving = "idle";
    saveName = "";
    open = false;
  }

  function handleOverwrite() {
    if (activePresetId) onOverwritePreset?.(activePresetId);
    saving = "idle";
    open = false;
  }

  function handleSaveAsNew() {
    saving = "name";
    saveName = "";
  }

  const activePreset = $derived(presets.find((p) => p.id === activePresetId));
</script>

<div class="relative">
  <button
    type="button"
    onclick={() => {
      open = !open;
      saving = "idle";
    }}
    class={cn(
      "flex items-center gap-1.5 px-2 py-1.5",
      "text-[0.72rem] transition-colors duration-fast",
      activePresetId
        ? "text-text-accent bg-accent-950"
        : "text-text-muted hover:text-text-primary hover:bg-surface-2",
    )}
    title={activePreset ? `Preset: ${activePreset.name}` : "Filter presets"}
  >
    <Bookmark class="h-3.5 w-3.5" />
    <span class="hidden sm:inline">
      {activePreset ? activePreset.name : "Presets"}
    </span>
  </button>

  {#if open}
    <button
      type="button"
      class="fixed inset-0 z-40"
      aria-label="Close preset menu"
      onclick={() => (open = false)}
    ></button>
    <div class="absolute right-0 top-full mt-1 z-50 w-56 surface-elevated py-1">
      {#if presets.length > 0}
        <div class="max-h-48 overflow-y-auto tag-scroll-area">
          {#each presets as preset (preset.id)}
            <div
              class={cn(
                "flex items-center gap-1 w-full px-3 py-1.5 text-[0.72rem] transition-colors duration-fast group",
                preset.id === activePresetId
                  ? "text-text-accent bg-accent-950"
                  : "text-text-muted hover:text-text-primary hover:bg-surface-3",
              )}
            >
              <Check
                class={cn(
                  "h-3 w-3 shrink-0",
                  preset.id === activePresetId ? "opacity-100" : "opacity-0",
                )}
              />
              <button
                type="button"
                class="flex-1 text-left truncate"
                onclick={() => {
                  onApplyPreset?.(preset);
                  open = false;
                }}
              >
                {preset.name}
              </button>
              <button
                type="button"
                onclick={(e) => {
                  e.stopPropagation();
                  onDeletePreset?.(preset.id);
                }}
                class="opacity-0 group-hover:opacity-100 text-text-disabled hover:text-error-text transition-opacity duration-fast shrink-0"
                title="Delete preset"
                aria-label={`Delete preset ${preset.name}`}
              >
                <Trash2 class="h-3 w-3" />
              </button>
            </div>
          {/each}
        </div>
      {:else}
        <div class="px-3 py-2 text-[0.68rem] text-text-disabled text-center">
          No saved presets
        </div>
      {/if}

      <div class="h-px bg-border-subtle my-1"></div>

      {#if saving === "idle"}
        <button
          type="button"
          onclick={handleSaveClick}
          class="flex items-center gap-2 w-full px-3 py-1.5 text-[0.72rem] text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors duration-fast"
        >
          <Plus class="h-3 w-3" />
          Save current filters
        </button>
      {:else if saving === "name"}
        <div class="px-3 py-2 space-y-2">
          <input
            bind:this={nameInput}
            type="text"
            placeholder="Preset name..."
            bind:value={saveName}
            onkeydown={(e) => {
              if (e.key === "Enter") handleConfirmSave();
              if (e.key === "Escape") saving = "idle";
            }}
            class={cn(
              "w-full bg-surface-1 border border-border-subtle",
              "px-2 py-1 text-[0.7rem] text-text-primary",
              "placeholder:text-text-disabled",
              "focus:outline-none focus:border-border-accent",
              "transition-colors duration-fast",
            )}
          />
          <div class="flex gap-1">
            <button
              type="button"
              onclick={handleConfirmSave}
              disabled={!saveName.trim()}
              class={cn(
                "flex-1 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wider transition-colors duration-fast",
                saveName.trim()
                  ? "bg-accent-900/50 text-accent-200 hover:bg-accent-800/50"
                  : "bg-surface-3 text-text-disabled cursor-not-allowed",
              )}
            >
              Save
            </button>
            <button
              type="button"
              onclick={() => (saving = "idle")}
              class="px-2 py-1 text-[0.65rem] text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors duration-fast"
              aria-label="Cancel"
            >
              <X class="h-3 w-3" />
            </button>
          </div>
        </div>
      {:else if saving === "confirm" && activePreset}
        <div class="px-3 py-2 space-y-2">
          <div class="text-[0.68rem] text-text-muted">
            Overwrite <span class="text-text-accent">{activePreset.name}</span>?
          </div>
          <div class="flex gap-1">
            <button
              type="button"
              onclick={handleOverwrite}
              class="flex-1 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wider bg-accent-900/50 text-accent-200 hover:bg-accent-800/50 transition-colors duration-fast"
            >
              Overwrite
            </button>
            <button
              type="button"
              onclick={handleSaveAsNew}
              class="flex-1 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors duration-fast"
            >
              Save as new
            </button>
          </div>
          <button
            type="button"
            onclick={() => (saving = "idle")}
            class="w-full text-center text-[0.6rem] text-text-disabled hover:text-text-muted transition-colors duration-fast"
          >
            Cancel
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>
