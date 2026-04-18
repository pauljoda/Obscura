<script lang="ts">
  import { goto, invalidate } from "$app/navigation";
  import { Plus } from "@lucide/svelte";
  import { Button } from "@obscura/ui-svelte";
  import { createTag } from "$lib/api/entities";

  let name = $state("");
  let aliasesRaw = $state("");
  let saving = $state(false);
  let error = $state<string | null>(null);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!name.trim() || saving) return;
    saving = true;
    error = null;
    try {
      const aliases = aliasesRaw
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const created = await createTag({ name: name.trim(), aliases });
      await invalidate("tags");
      await goto(`/tags/${created.id}`);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>New tag — Obscura</title>
</svelte:head>

<div class="max-w-2xl space-y-6">
  <header>
    <p class="text-kicker text-text-muted">Browse</p>
    <h1 class="text-h1 text-text-primary">New tag</h1>
  </header>

  <form onsubmit={handleSubmit} class="surface-panel p-5 space-y-4">
    <div class="space-y-1.5">
      <label for="name" class="text-label text-text-muted">Name</label>
      <input
        id="name"
        type="text"
        bind:value={name}
        required
        maxlength={120}
        autocomplete="off"
        class="w-full bg-surface-2 border border-border-default px-3 py-2 text-body text-text-primary focus:border-border-accent outline-none transition-colors duration-fast"
        placeholder="e.g. cinematic"
      />
    </div>

    <div class="space-y-1.5">
      <label for="aliases" class="text-label text-text-muted">
        Aliases <span class="text-text-disabled">(comma or newline separated)</span>
      </label>
      <textarea
        id="aliases"
        bind:value={aliasesRaw}
        rows="3"
        class="w-full bg-surface-2 border border-border-default px-3 py-2 text-body text-text-primary focus:border-border-accent outline-none transition-colors duration-fast resize-none"
      ></textarea>
    </div>

    {#if error}
      <div class="text-error-text text-body-sm">{error}</div>
    {/if}

    <div class="flex items-center gap-3 pt-2 border-t border-border-subtle">
      <Button variant="primary" size="md" type="submit" disabled={saving || !name.trim()}>
        <Plus class="h-4 w-4" />
        {saving ? "Creating…" : "Create tag"}
      </Button>
      <a href="/tags" class="text-body-sm text-text-muted hover:text-text-primary">Cancel</a>
    </div>
  </form>
</div>
