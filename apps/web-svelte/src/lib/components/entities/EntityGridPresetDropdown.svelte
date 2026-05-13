<script lang="ts">
  import { Bookmark, Check, Plus, Trash2, X } from "@lucide/svelte";
  import { cn } from "@obscura/ui-svelte";
  import type { FilterPreset } from "$lib/filter-presets";

  interface Props {
    activePresetId?: string | null;
    onApplyPreset?: (preset: FilterPreset) => void;
    onDeletePreset?: (id: string) => void;
    onOverwritePreset?: (id: string) => void;
    onSavePreset?: (name: string) => void;
    presets?: FilterPreset[];
  }

  let {
    activePresetId = null,
    onApplyPreset,
    onDeletePreset,
    onOverwritePreset,
    onSavePreset,
    presets = [],
  }: Props = $props();

  let nameInput: HTMLInputElement | undefined = $state();
  let open = $state(false);
  let saveName = $state("");
  let saving = $state<"idle" | "name" | "confirm">("idle");

  const activePreset = $derived(presets.find((preset) => preset.id === activePresetId));

  $effect(() => {
    if (saving === "name" && nameInput) nameInput.focus();
  });

  function close() {
    open = false;
    saving = "idle";
  }

  function handleConfirmSave() {
    const trimmed = saveName.trim();
    if (!trimmed) return;
    onSavePreset?.(trimmed);
    saveName = "";
    close();
  }

  function handleSaveClick() {
    if (activePresetId) {
      saving = "confirm";
      return;
    }

    saveName = "";
    saving = "name";
  }

  function handleOverwrite() {
    if (activePresetId) onOverwritePreset?.(activePresetId);
    close();
  }
</script>

<div class="relative">
  <button
    type="button"
    onclick={() => {
      open = !open;
      saving = "idle";
    }}
    class={cn(
      "flex items-center gap-1.5 px-2 py-1.5 text-[0.72rem] transition-colors duration-fast",
      activePresetId
        ? "bg-accent-950 text-text-accent"
        : "text-text-muted hover:bg-surface-2 hover:text-text-primary",
    )}
    title={activePreset ? `Preset: ${activePreset.name}` : "Filter presets"}
  >
    <Bookmark class="h-3.5 w-3.5" />
    <span class="hidden sm:inline">{activePreset ? activePreset.name : "Presets"}</span>
  </button>

  {#if open}
    <button
      type="button"
      class="fixed inset-0 z-40"
      aria-label="Close preset menu"
      onclick={close}
    ></button>
    <div class="surface-elevated absolute right-0 top-full z-50 mt-1 w-56 py-1">
      {#if presets.length > 0}
        <div class="tag-scroll-area max-h-48 overflow-y-auto">
          {#each presets as preset (preset.id)}
            <div
              class={cn(
                "group flex w-full items-center gap-1 px-3 py-1.5 text-[0.72rem] transition-colors duration-fast",
                preset.id === activePresetId
                  ? "bg-accent-950 text-text-accent"
                  : "text-text-muted hover:bg-surface-3 hover:text-text-primary",
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
                class="min-w-0 flex-1 truncate text-left"
                onclick={() => {
                  onApplyPreset?.(preset);
                  close();
                }}
              >
                {preset.name}
              </button>
              <button
                type="button"
                class="shrink-0 text-text-disabled opacity-0 transition-opacity duration-fast hover:text-error-text group-hover:opacity-100"
                title="Delete preset"
                aria-label={`Delete preset ${preset.name}`}
                onclick={(event) => {
                  event.stopPropagation();
                  onDeletePreset?.(preset.id);
                }}
              >
                <Trash2 class="h-3 w-3" />
              </button>
            </div>
          {/each}
        </div>
      {:else}
        <div class="px-3 py-2 text-center text-[0.68rem] text-text-disabled">
          No saved presets
        </div>
      {/if}

      <div class="my-1 h-px bg-border-subtle"></div>

      {#if saving === "idle"}
        <button
          type="button"
          class="flex w-full items-center gap-2 px-3 py-1.5 text-[0.72rem] text-text-muted transition-colors duration-fast hover:bg-surface-3 hover:text-text-primary"
          onclick={handleSaveClick}
        >
          <Plus class="h-3 w-3" />
          Save current filters
        </button>
      {:else if saving === "name"}
        <div class="space-y-2 px-3 py-2">
          <input
            bind:this={nameInput}
            bind:value={saveName}
            type="text"
            placeholder="Preset name..."
            class={cn(
              "w-full border border-border-subtle bg-surface-1 px-2 py-1 text-[0.7rem] text-text-primary",
              "placeholder:text-text-disabled focus:border-border-accent focus:outline-none",
              "transition-colors duration-fast",
            )}
            onkeydown={(event) => {
              if (event.key === "Enter") handleConfirmSave();
              if (event.key === "Escape") saving = "idle";
            }}
          />
          <div class="flex gap-1">
            <button
              type="button"
              class={cn(
                "flex-1 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wider transition-colors duration-fast",
                saveName.trim()
                  ? "bg-accent-900/50 text-accent-200 hover:bg-accent-800/50"
                  : "cursor-not-allowed bg-surface-3 text-text-disabled",
              )}
              disabled={!saveName.trim()}
              onclick={handleConfirmSave}
            >
              Save
            </button>
            <button
              type="button"
              class="px-2 py-1 text-[0.65rem] text-text-muted transition-colors duration-fast hover:bg-surface-3 hover:text-text-primary"
              aria-label="Cancel"
              onclick={() => (saving = "idle")}
            >
              <X class="h-3 w-3" />
            </button>
          </div>
        </div>
      {:else if saving === "confirm" && activePreset}
        <div class="space-y-2 px-3 py-2">
          <div class="text-[0.68rem] text-text-muted">
            Overwrite <span class="text-text-accent">{activePreset.name}</span>?
          </div>
          <div class="flex gap-1">
            <button
              type="button"
              class="flex-1 bg-accent-900/50 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-accent-200 transition-colors duration-fast hover:bg-accent-800/50"
              onclick={handleOverwrite}
            >
              Overwrite
            </button>
            <button
              type="button"
              class="flex-1 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-text-muted transition-colors duration-fast hover:bg-surface-3 hover:text-text-primary"
              onclick={() => {
                saveName = "";
                saving = "name";
              }}
            >
              Save as new
            </button>
          </div>
          <button
            type="button"
            class="w-full text-center text-[0.6rem] text-text-disabled transition-colors duration-fast hover:text-text-muted"
            onclick={() => (saving = "idle")}
          >
            Cancel
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>
