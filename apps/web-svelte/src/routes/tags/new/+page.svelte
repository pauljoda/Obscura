<script lang="ts">
  import { goto, invalidate } from "$app/navigation";
  import { ArrowLeft, Save, Loader } from "@lucide/svelte";
  import { Button } from "@obscura/ui-svelte";
  import { createTag } from "$lib/api/entities";

  let name = $state("");
  let description = $state("");
  let aliases = $state("");
  let isNsfw = $state(false);
  let saving = $state(false);
  let error = $state<string | null>(null);
  let nameInput: HTMLInputElement | undefined = $state();

  $effect(() => {
    nameInput?.focus();
  });

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    saving = true;
    error = null;
    try {
      await createTag({
        name: trimmed,
        description: description.trim() || undefined,
        aliases: aliases.trim() || undefined,
      });
      await invalidate("tags");
      await goto(`/tags/${encodeURIComponent(trimmed)}`);
    } catch (err) {
      error = err instanceof Error ? err.message : "Create failed";
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>New tag — Obscura</title>
</svelte:head>

<div class="space-y-6">
  <header class="flex items-center justify-between gap-4">
    <div class="flex items-center gap-3">
      <a
        href="/tags"
        class="inline-flex items-center gap-1.5 surface-well px-2.5 py-1 text-[0.72rem] text-text-muted hover:text-text-accent transition-colors duration-fast"
      >
        <ArrowLeft class="h-3 w-3" />
        Back
      </a>
      <h1 class="text-lg font-heading font-semibold">New tag</h1>
    </div>
    <Button
      variant="primary"
      size="md"
      type="submit"
      form="tag-create-form"
      disabled={saving || !name.trim()}
    >
      {#if saving}
        <Loader class="h-3 w-3 animate-spin" />
      {:else}
        <Save class="h-3 w-3" />
      {/if}
      Create
    </Button>
  </header>

  {#if error}
    <div class="surface-panel border-error/30 p-3 text-body-sm text-error-text">{error}</div>
  {/if}

  <form id="tag-create-form" onsubmit={handleSubmit} class="max-w-2xl surface-panel p-5 space-y-4">
    <div class="space-y-1.5">
      <label for="tag-name" class="text-label text-text-muted">Name</label>
      <input
        id="tag-name"
        type="text"
        bind:this={nameInput}
        bind:value={name}
        required
        maxlength={120}
        autocomplete="off"
        class="w-full bg-surface-2 border border-border-default px-3 py-2 text-body text-text-primary focus:border-border-accent outline-none transition-colors duration-fast"
        placeholder="e.g. cinematic"
      />
    </div>

    <div class="space-y-1.5">
      <label for="tag-description" class="text-label text-text-muted">Description</label>
      <textarea
        id="tag-description"
        bind:value={description}
        rows="3"
        class="w-full bg-surface-2 border border-border-default px-3 py-2 text-body text-text-primary focus:border-border-accent outline-none transition-colors duration-fast resize-none"
      ></textarea>
    </div>

    <div class="space-y-1.5">
      <label for="tag-aliases" class="text-label text-text-muted">
        Aliases <span class="text-text-disabled">(comma-separated)</span>
      </label>
      <input
        id="tag-aliases"
        type="text"
        bind:value={aliases}
        autocomplete="off"
        class="w-full bg-surface-2 border border-border-default px-3 py-2 text-body text-text-primary focus:border-border-accent outline-none transition-colors duration-fast"
        placeholder="alt-name, other-name"
      />
    </div>

    <label class="flex items-center gap-2 text-body-sm text-text-secondary">
      <input type="checkbox" bind:checked={isNsfw} class="accent-accent-500" />
      NSFW tag
    </label>
  </form>
</div>
