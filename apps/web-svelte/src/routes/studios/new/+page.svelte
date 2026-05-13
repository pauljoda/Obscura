<script lang="ts">
  import { goto, invalidate } from "$app/navigation";
  import { ArrowLeft, Building2, FileText, Link, Tag as TagIcon } from "@lucide/svelte";
  import { createStudio } from "$lib/v1/api/entities-v1";
  import {
    EditFormShell,
    TextField,
    TextAreaField,
  } from "$lib/components/forms";

  let name = $state("");
  let description = $state("");
  let aliases = $state("");
  let url = $state("");
  let saving = $state(false);
  let error = $state<string | null>(null);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    saving = true;
    error = null;
    try {
      await createStudio({
        name: trimmed,
        description: description.trim() || undefined,
        aliases: aliases.trim() || undefined,
        url: url.trim() || undefined,
      });
      await invalidate("studios");
      await goto(`/studios/${encodeURIComponent(trimmed)}`);
    } catch (err) {
      error = err instanceof Error ? err.message : "Create failed";
      saving = false;
    }
  }

  function handleCancel() {
    void goto("/studios");
  }
</script>

<svelte:head>
  <title>New studio — Obscura</title>
</svelte:head>

<div class="space-y-5">
  <header class="flex items-center gap-3">
    <a
      href="/studios"
      class="inline-flex items-center gap-1.5 surface-well px-2.5 py-1 text-[0.72rem] text-text-muted hover:text-text-accent transition-colors duration-fast"
    >
      <ArrowLeft class="h-3 w-3" />
      Back
    </a>
    <h1 class="text-lg font-heading font-semibold">New studio</h1>
  </header>

  <div class="max-w-2xl">
    <EditFormShell
      title="Studio details"
      onSave={handleSave}
      onCancel={handleCancel}
      {saving}
      saveDisabled={!name.trim()}
      saveLabel="Create studio"
      {error}
    >
      <TextField
        label="Name"
        icon={Building2}
        value={name}
        onChange={(v) => (name = v)}
        placeholder="Studio name"
        required
      />
      <TextAreaField
        label="Description"
        icon={FileText}
        value={description}
        onChange={(v) => (description = v)}
        placeholder="Optional notes about the studio"
      />
      <TextField
        label="Aliases"
        icon={TagIcon}
        value={aliases}
        onChange={(v) => (aliases = v)}
        helper="Comma-separated alternate names this studio is known by."
      />
      <TextField
        label="URL"
        icon={Link}
        value={url}
        onChange={(v) => (url = v)}
        type="url"
        placeholder="https://…"
      />
    </EditFormShell>
  </div>
</div>
