<script lang="ts">
  import { goto, invalidate } from "$app/navigation";
  import { AlertTriangle, ArrowLeft, FileText, Tag as TagIcon } from "@lucide/svelte";
  import { createTag } from "$lib/v1/api/entities-v1";
  import {
    EditFormShell,
    FormField,
    TextAreaField,
    TextField,
    ToggleChip,
  } from "$lib/components/forms";

  let name = $state("");
  let description = $state("");
  let aliases = $state("");
  let isNsfw = $state(false);
  let saving = $state(false);
  let error = $state<string | null>(null);

  async function handleSave() {
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

  function handleCancel() {
    void goto("/tags");
  }
</script>

<svelte:head>
  <title>New tag — Obscura</title>
</svelte:head>

<div class="space-y-5">
  <header class="flex items-center gap-3">
    <a
      href="/tags"
      class="inline-flex items-center gap-1.5 surface-well px-2.5 py-1 text-[0.72rem] text-text-muted hover:text-text-accent transition-colors duration-fast"
    >
      <ArrowLeft class="h-3 w-3" />
      Back
    </a>
    <h1 class="text-lg font-heading font-semibold">New tag</h1>
  </header>

  <div class="max-w-2xl">
    <EditFormShell
      title="Tag details"
      onSave={handleSave}
      onCancel={handleCancel}
      {saving}
      saveDisabled={!name.trim()}
      saveLabel="Create tag"
      {error}
    >
      <TextField
        label="Name"
        icon={TagIcon}
        value={name}
        onChange={(v) => (name = v)}
        placeholder="e.g. cinematic"
        required
      />
      <TextAreaField
        label="Description"
        icon={FileText}
        value={description}
        onChange={(v) => (description = v)}
        placeholder="Optional notes"
      />
      <TextField
        label="Aliases"
        value={aliases}
        onChange={(v) => (aliases = v)}
        placeholder="alt-name, other-name"
        helper="Comma-separated alternate names."
      />
      <FormField label="Flags">
        <ToggleChip
          value={isNsfw}
          onChange={(v) => (isNsfw = v)}
          onLabel="Marked NSFW"
          offLabel="Mark as NSFW"
          icon={AlertTriangle}
          variant="warning"
        />
      </FormField>
    </EditFormShell>
  </div>
</div>
