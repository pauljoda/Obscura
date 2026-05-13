<script lang="ts">
  import { goto, invalidate } from "$app/navigation";
  import { ArrowLeft, Calendar, Globe, Tag as TagIcon, User, Users } from "@lucide/svelte";
  import { createPerformer } from "$lib/v1/api/entities-v1";
  import {
    DateField,
    EditFormShell,
    SearchSelect,
    TextField,
    type SearchOption,
  } from "$lib/components/forms";

  let name = $state("");
  let disambiguation = $state("");
  let aliases = $state("");
  let gender = $state("");
  let country = $state("");
  let birthdate = $state("");
  let saving = $state(false);
  let error = $state<string | null>(null);

  const genderOptions: SearchOption[] = [
    { id: "male", name: "Male" },
    { id: "female", name: "Female" },
    { id: "transgender_male", name: "Transgender male" },
    { id: "transgender_female", name: "Transgender female" },
    { id: "intersex", name: "Intersex" },
    { id: "non_binary", name: "Non-binary" },
  ];

  function genderLabelToValue(label: string): string {
    return genderOptions.find((g) => g.name === label)?.id ?? "";
  }

  function genderValueToLabel(value: string): string {
    return genderOptions.find((g) => g.id === value)?.name ?? "";
  }

  async function handleSave() {
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

  function handleCancel() {
    void goto("/performers");
  }
</script>

<svelte:head>
  <title>New actor — Obscura</title>
</svelte:head>

<div class="space-y-5">
  <header class="flex items-center gap-3">
    <a
      href="/performers"
      class="inline-flex items-center gap-1.5 surface-well px-2.5 py-1 text-[0.72rem] text-text-muted hover:text-text-accent transition-colors duration-fast"
    >
      <ArrowLeft class="h-3 w-3" />
      Back
    </a>
    <h1 class="text-lg font-heading font-semibold">New actor</h1>
  </header>

  <div class="max-w-2xl">
    <EditFormShell
      title="Actor details"
      onSave={handleSave}
      onCancel={handleCancel}
      {saving}
      saveDisabled={!name.trim()}
      saveLabel="Create actor"
      {error}
    >
      <TextField
        label="Name"
        icon={User}
        value={name}
        onChange={(v) => (name = v)}
        placeholder="Full name"
        required
      />
      <TextField
        label="Disambiguation"
        value={disambiguation}
        onChange={(v) => (disambiguation = v)}
        placeholder='e.g. "II" or "the Younger"'
        helper="Used when two actors share a name."
      />
      <div class="grid gap-4 md:grid-cols-2">
        <SearchSelect
          label="Gender"
          icon={Users}
          value={genderValueToLabel(gender)}
          onChange={(label) => (gender = genderLabelToValue(label))}
          options={genderOptions}
          placeholder="—"
        />
        <TextField
          label="Country"
          icon={Globe}
          value={country}
          onChange={(v) => (country = v)}
        />
      </div>
      <DateField
        label="Birthdate"
        icon={Calendar}
        value={birthdate}
        onChange={(v) => (birthdate = v)}
      />
      <TextField
        label="Aliases"
        icon={TagIcon}
        value={aliases}
        onChange={(v) => (aliases = v)}
        helper="Comma-separated alternate names."
      />
    </EditFormShell>
  </div>
</div>
