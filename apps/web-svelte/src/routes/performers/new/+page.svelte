<script lang="ts">
  import { goto, invalidate } from "$app/navigation";
  import { ArrowLeft, Save, Loader } from "@lucide/svelte";
  import { Button } from "@obscura/ui-svelte";
  import { createPerformer } from "$lib/api/entities";

  let name = $state("");
  let disambiguation = $state("");
  let aliases = $state("");
  let gender = $state("");
  let country = $state("");
  let birthdate = $state("");
  let saving = $state(false);
  let error = $state<string | null>(null);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    saving = true;
    error = null;
    try {
      const result = await createPerformer({
        name: trimmed,
        disambiguation: disambiguation.trim() || undefined,
        aliases: aliases.trim() || undefined,
        gender: gender || undefined,
        country: country.trim() || undefined,
        birthdate: birthdate || undefined,
      });
      await invalidate("performers");
      await goto(`/performers/${result.id}`);
    } catch (err) {
      error = err instanceof Error ? err.message : "Create failed";
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>New actor — Obscura</title>
</svelte:head>

<div class="space-y-6">
  <header class="flex items-center justify-between gap-4">
    <div class="flex items-center gap-3">
      <a
        href="/performers"
        class="inline-flex items-center gap-1.5 surface-well px-2.5 py-1 text-[0.72rem] text-text-muted hover:text-text-accent transition-colors duration-fast"
      >
        <ArrowLeft class="h-3 w-3" />
        Back
      </a>
      <h1 class="text-lg font-heading font-semibold">New actor</h1>
    </div>
    <Button variant="primary" size="md" type="submit" form="performer-create-form" disabled={saving || !name.trim()}>
      {#if saving}<Loader class="h-3 w-3 animate-spin" />{:else}<Save class="h-3 w-3" />{/if}
      Create
    </Button>
  </header>

  {#if error}
    <div class="surface-panel border-error/30 p-3 text-body-sm text-error-text">{error}</div>
  {/if}

  <form id="performer-create-form" onsubmit={handleSubmit} class="max-w-2xl surface-panel p-5 space-y-4">
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div class="space-y-1.5 sm:col-span-2">
        <label for="p-name" class="text-label text-text-muted">Name</label>
        <input
          id="p-name"
          type="text"
          bind:value={name}
          required
          maxlength={200}
          autofocus
          class="w-full bg-surface-2 border border-border-default px-3 py-2 text-body text-text-primary focus:border-border-accent outline-none transition-colors duration-fast"
        />
      </div>

      <div class="space-y-1.5 sm:col-span-2">
        <label for="p-disambig" class="text-label text-text-muted">
          Disambiguation <span class="text-text-disabled">(e.g. "II")</span>
        </label>
        <input
          id="p-disambig"
          type="text"
          bind:value={disambiguation}
          class="w-full bg-surface-2 border border-border-default px-3 py-2 text-body text-text-primary focus:border-border-accent outline-none transition-colors duration-fast"
        />
      </div>

      <div class="space-y-1.5">
        <label for="p-gender" class="text-label text-text-muted">Gender</label>
        <select
          id="p-gender"
          bind:value={gender}
          class="w-full bg-surface-2 border border-border-default px-3 py-2 text-body text-text-primary focus:border-border-accent outline-none transition-colors duration-fast"
        >
          <option value="">—</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="transgender_male">Transgender male</option>
          <option value="transgender_female">Transgender female</option>
          <option value="intersex">Intersex</option>
          <option value="non_binary">Non-binary</option>
        </select>
      </div>

      <div class="space-y-1.5">
        <label for="p-country" class="text-label text-text-muted">Country</label>
        <input
          id="p-country"
          type="text"
          bind:value={country}
          class="w-full bg-surface-2 border border-border-default px-3 py-2 text-body text-text-primary focus:border-border-accent outline-none transition-colors duration-fast"
        />
      </div>

      <div class="space-y-1.5">
        <label for="p-birthdate" class="text-label text-text-muted">Birthdate</label>
        <input
          id="p-birthdate"
          type="date"
          bind:value={birthdate}
          class="w-full bg-surface-2 border border-border-default px-3 py-2 text-body text-text-primary focus:border-border-accent outline-none transition-colors duration-fast"
        />
      </div>

      <div class="space-y-1.5 sm:col-span-2">
        <label for="p-aliases" class="text-label text-text-muted">
          Aliases <span class="text-text-disabled">(comma-separated)</span>
        </label>
        <input
          id="p-aliases"
          type="text"
          bind:value={aliases}
          class="w-full bg-surface-2 border border-border-default px-3 py-2 text-body text-text-primary focus:border-border-accent outline-none transition-colors duration-fast"
        />
      </div>
    </div>
  </form>
</div>
