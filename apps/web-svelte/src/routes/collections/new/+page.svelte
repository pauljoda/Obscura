<script lang="ts">
  import { goto, invalidate } from "$app/navigation";
  import { ArrowLeft, Save, Loader } from "@lucide/svelte";
  import { Button } from "@obscura/ui-svelte";
  import { createCollection } from "$lib/api/media";

  let name = $state("");
  let description = $state("");
  let mode = $state<"manual" | "smart">("manual");
  let saving = $state(false);
  let error = $state<string | null>(null);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    saving = true;
    error = null;
    try {
      const created = await createCollection({
        name: trimmed,
        description: description.trim() || undefined,
        mode,
      });
      await invalidate("collections");
      await goto(`/collections/${created.id}`);
    } catch (err) {
      error = err instanceof Error ? err.message : "Create failed";
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>New collection — Obscura</title>
</svelte:head>

<div class="space-y-6">
  <header class="flex items-center justify-between gap-4">
    <div class="flex items-center gap-3">
      <a href="/collections" class="inline-flex items-center gap-1.5 surface-well px-2.5 py-1 text-[0.72rem] text-text-muted hover:text-text-accent">
        <ArrowLeft class="h-3 w-3" />
        Back
      </a>
      <h1 class="text-lg font-heading font-semibold">New collection</h1>
    </div>
    <Button variant="primary" size="md" type="submit" form="collection-create-form" disabled={saving || !name.trim()}>
      {#if saving}<Loader class="h-3 w-3 animate-spin" />{:else}<Save class="h-3 w-3" />{/if}
      Create
    </Button>
  </header>

  {#if error}
    <div class="surface-panel border-error/30 p-3 text-body-sm text-error-text">{error}</div>
  {/if}

  <form id="collection-create-form" onsubmit={handleSubmit} class="max-w-2xl surface-panel p-5 space-y-4">
    <div class="space-y-1.5">
      <label for="c-name" class="text-label text-text-muted">Name</label>
      <input
        id="c-name"
        type="text"
        bind:value={name}
        required
        maxlength={200}
        autofocus
        class="w-full bg-surface-2 border border-border-default px-3 py-2 text-body text-text-primary focus:border-border-accent outline-none transition-colors duration-fast"
      />
    </div>

    <div class="space-y-1.5">
      <label for="c-description" class="text-label text-text-muted">Description</label>
      <textarea
        id="c-description"
        bind:value={description}
        rows="3"
        class="w-full bg-surface-2 border border-border-default px-3 py-2 text-body text-text-primary focus:border-border-accent outline-none transition-colors duration-fast resize-none"
      ></textarea>
    </div>

    <div class="space-y-1.5">
      <label class="text-label text-text-muted">Mode</label>
      <div class="flex gap-2">
        <button
          type="button"
          onclick={() => (mode = "manual")}
          class="surface-well px-3 py-1.5 text-body-sm"
          class:border-border-accent={mode === "manual"}
          class:text-text-primary={mode === "manual"}
          class:text-text-muted={mode !== "manual"}
        >
          Manual
        </button>
        <button
          type="button"
          onclick={() => (mode = "smart")}
          class="surface-well px-3 py-1.5 text-body-sm"
          class:border-border-accent={mode === "smart"}
          class:text-text-primary={mode === "smart"}
          class:text-text-muted={mode !== "smart"}
        >
          Smart (rule-based)
        </button>
      </div>
      <p class="text-body-sm text-text-disabled">
        Smart rule builder lands in APP-75. For now, smart collections open empty.
      </p>
    </div>
  </form>
</div>
