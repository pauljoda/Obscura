<script lang="ts">
  import {
    AlertCircle,
    Check,
    ChevronDown,
    Images,
    Loader2,
    PanelRightClose,
    ScanSearch,
    X,
  } from "@lucide/svelte";
  import {
    applyIdentifyProposal,
    fetchIdentifyProviders,
    identifyEntity,
    type EntityMetadataProposal,
    type EntitySearchCandidate,
    type ImageCandidate,
    type PluginProvider,
  } from "$lib/api/identify";

  type LegacyEntityKind = "video_series" | "video_movie" | "video_episode" | "book";

  interface Props {
    entityKind: LegacyEntityKind | string;
    entityId: string;
    title: string;
    label?: string;
    class?: string;
    onApplied?: () => void | Promise<void>;
  }

  let { entityKind, entityId, title, label = "Identify", class: className, onApplied }: Props = $props();

  const fieldLabels: Record<string, string> = {
    title: "Title",
    description: "Description",
    externalIds: "Provider IDs",
    urls: "Links",
    tags: "Tags",
    studio: "Studio",
    credits: "Credits",
    dates: "Dates",
    counters: "Counters",
    stats: "Stats",
    positions: "Positions",
    classification: "Classification",
    images: "Artwork",
  };
  const fieldKeys = Object.keys(fieldLabels);

  let open = $state(false);
  let providers = $state<PluginProvider[]>([]);
  let loadingProviders = $state(false);
  let identifying = $state<string | null>(null);
  let proposal = $state<EntityMetadataProposal | null>(null);
  let selectedProviderId = $state<string | null>(null);
  let selectedFields = $state<Record<string, boolean>>({});
  let selectedImages = $state<Record<string, string | null>>({});
  let applying = $state(false);
  let error = $state<string | null>(null);

  const v2Kind = $derived(mapKind(entityKind));
  const selectedProvider = $derived.by(() =>
    providers.find((provider) => provider.id === selectedProviderId) ?? providers[0] ?? null,
  );

  async function toggleMenu() {
    open = !open;
    if (!open || providers.length > 0 || loadingProviders) return;
    loadingProviders = true;
    error = null;
    try {
      providers = await fetchIdentifyProviders(v2Kind);
    } catch (err) {
      error = readError(err);
    } finally {
      loadingProviders = false;
    }
  }

  async function run(provider: PluginProvider, candidate?: EntitySearchCandidate) {
    selectedProviderId = provider.id;
    identifying = provider.id;
    open = false;
    error = null;
    try {
      proposal = await identifyEntity(entityId, provider.id, candidate
        ? { externalIds: candidate.externalIds }
        : undefined);
      selectedFields = Object.fromEntries(fieldKeys.map((field) => [field, hasField(proposal!, field)]));
      selectedImages = defaultImageSelection(proposal.images);
    } catch (err) {
      error = readError(err);
    } finally {
      identifying = null;
    }
  }

  function rerunCandidate(candidate: EntitySearchCandidate) {
    if (!selectedProvider) return;
    void run(selectedProvider, candidate);
  }

  async function apply() {
    if (!proposal) return;
    applying = true;
    error = null;
    try {
      const fields = Object.entries(selectedFields)
        .filter(([, enabled]) => enabled)
        .map(([field]) => field);
      await applyIdentifyProposal(entityId, proposal, fields, selectedImages);
      await onApplied?.();
      closeDrawer();
    } catch (err) {
      error = readError(err);
    } finally {
      applying = false;
    }
  }

  function closeDrawer() {
    proposal = null;
    selectedFields = {};
    selectedImages = {};
  }

  function fieldValue(result: EntityMetadataProposal, field: string): string {
    const patch = result.patch;
    if (field === "title") return patch.title ?? "";
    if (field === "description") return patch.description ?? "";
    if (field === "externalIds") return entries(patch.externalIds).join(", ");
    if (field === "urls") return patch.urls.join(", ");
    if (field === "tags") return patch.tags.join(", ");
    if (field === "studio") return patch.studio ?? "";
    if (field === "credits") return patch.credits.map((credit) => credit.character ? `${credit.name} as ${credit.character}` : credit.name).join(", ");
    if (field === "dates") return entries(patch.dates).join(", ");
    if (field === "counters") return entries(patch.counters).join(", ");
    if (field === "stats") return entries(patch.stats).join(", ");
    if (field === "positions") return entries(patch.positions).join(", ");
    if (field === "classification") return patch.classification ?? "";
    if (field === "images") return `${result.images.length} candidate${result.images.length === 1 ? "" : "s"}`;
    return "";
  }

  function hasField(result: EntityMetadataProposal, field: string): boolean {
    return fieldValue(result, field).trim().length > 0;
  }

  function imageGroups(images: ImageCandidate[]): Array<{ kind: string; images: ImageCandidate[] }> {
    const groups: Record<string, ImageCandidate[]> = {};
    for (const image of images) groups[image.kind] = [...(groups[image.kind] ?? []), image];
    return Object.entries(groups).map(([kind, rows]) => ({ kind, images: rows }));
  }

  function defaultImageSelection(images: ImageCandidate[]): Record<string, string | null> {
    const selected: Record<string, string | null> = {};
    for (const group of imageGroups(images)) selected[group.kind] = group.images[0]?.url ?? null;
    return selected;
  }

  function entries(record: Record<string, string | number>): string[] {
    return Object.entries(record).map(([key, value]) => `${key}: ${value}`);
  }

  function mapKind(kind: string): string {
    if (kind === "video_series") return "video-series";
    return "video";
  }

  function readError(err: unknown): string {
    if (!(err instanceof Error)) return "Identify failed";
    try {
      const parsed = JSON.parse(err.message) as { message?: string; detail?: string };
      return parsed.message ?? parsed.detail ?? err.message;
    } catch {
      return err.message;
    }
  }
</script>

<div class={["identify-button-shell", className]}>
  <button type="button" class="identify-button" disabled={Boolean(identifying)} onclick={() => void toggleMenu()}>
    {#if identifying}
      <Loader2 class="h-4 w-4 animate-spin" />
    {:else}
      <ScanSearch class="h-4 w-4" />
    {/if}
    <span>{label}</span>
    <ChevronDown class="h-3.5 w-3.5" />
  </button>

  {#if open}
    <div class="provider-menu">
      {#if loadingProviders}
        <div class="menu-state"><Loader2 class="h-4 w-4 animate-spin" /> Loading</div>
      {:else if providers.length === 0}
        <div class="menu-state">No providers</div>
      {:else}
        {#each providers as provider (provider.id)}
          <button
            type="button"
            disabled={provider.missingAuthKeys.length > 0}
            onclick={() => void run(provider)}
          >
            <span>{provider.name}</span>
            <small>{provider.missingAuthKeys.length > 0 ? "Missing credentials" : `v${provider.version}`}</small>
          </button>
        {/each}
      {/if}
    </div>
  {/if}

  {#if error}
    <div class="inline-error" role="alert">
      <AlertCircle class="h-3.5 w-3.5" />
      <span>{error}</span>
      <button type="button" aria-label="Dismiss identify error" onclick={() => (error = null)}>
        <X class="h-3.5 w-3.5" />
      </button>
    </div>
  {/if}
</div>

{#if proposal}
  <aside class="identify-review" aria-label={`Review metadata for ${title}`}>
    <header>
      <div>
        <p>{proposal.provider} · {proposal.matchReason ?? "match"}</p>
        <h2>{proposal.patch.title ?? title}</h2>
      </div>
      <button type="button" class="icon-button" aria-label="Close identify review" onclick={closeDrawer}>
        <PanelRightClose class="h-4 w-4" />
      </button>
    </header>

    {#if proposal.candidates.length > 1}
      <section>
        <h3>Candidates</h3>
        <div class="candidate-grid">
          {#each proposal.candidates as candidate (candidate.externalIds.tmdb ?? candidate.title)}
            <button type="button" onclick={() => rerunCandidate(candidate)}>
              {#if candidate.posterUrl}
                <img src={candidate.posterUrl} alt="" />
              {/if}
              <span>{candidate.title}</span>
              <small>{candidate.year ?? ""}</small>
            </button>
          {/each}
        </div>
      </section>
    {/if}

    <section>
      <h3>Fields</h3>
      <div class="field-list">
        {#each fieldKeys as field (field)}
          {#if hasField(proposal, field)}
            <label>
              <input type="checkbox" bind:checked={selectedFields[field]} />
              <span>{fieldLabels[field]}</span>
              <small>{fieldValue(proposal, field)}</small>
            </label>
          {/if}
        {/each}
      </div>
    </section>

    {#if proposal.images.length > 0}
      <section>
        <h3><Images class="h-4 w-4" /> Artwork</h3>
        {#each imageGroups(proposal.images) as group (group.kind)}
          <div class="image-group">
            <p>{group.kind}</p>
            <div>
              {#each group.images as image (image.url)}
                <button
                  type="button"
                  class:active={selectedImages[group.kind] === image.url}
                  onclick={() => (selectedImages[group.kind] = image.url)}
                >
                  <img src={image.url} alt="" />
                </button>
              {/each}
            </div>
          </div>
        {/each}
      </section>
    {/if}

    <footer>
      <button type="button" class="ghost-button" onclick={closeDrawer}>Reject</button>
      <button type="button" class="apply-button" disabled={applying} onclick={() => void apply()}>
        {#if applying}
          <Loader2 class="h-4 w-4 animate-spin" />
        {:else}
          <Check class="h-4 w-4" />
        {/if}
        Apply
      </button>
    </footer>
  </aside>
{/if}

<style>
  .identify-button-shell { position: relative; display: inline-flex; align-items: center; }
  button { border-radius: 0; cursor: pointer; }
  button:disabled { cursor: not-allowed; opacity: 0.55; }
  .identify-button, .icon-button, .ghost-button, .apply-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    min-height: 2.1rem;
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-2, #111827);
    color: var(--color-text);
    padding: 0 0.65rem;
    font-size: 0.76rem;
  }
  .identify-button { border-color: rgba(196, 154, 90, 0.55); box-shadow: 0 0 14px rgba(196, 154, 90, 0.12); }
  .icon-button { width: 2.2rem; padding: 0; }
  .provider-menu {
    position: absolute;
    right: 0;
    top: calc(100% + 0.35rem);
    z-index: 50;
    display: grid;
    min-width: 14rem;
    border: 1px solid var(--color-border, #1c2235);
    background: rgba(9, 12, 18, 0.96);
    backdrop-filter: blur(14px);
  }
  .provider-menu button, .menu-state {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    border: 0;
    border-bottom: 1px solid var(--color-border, #1c2235);
    background: transparent;
    color: var(--color-text);
    padding: 0.65rem;
    text-align: left;
  }
  .provider-menu button:last-child { border-bottom: 0; }
  small, p { margin: 0; color: var(--color-text-muted); }
  .inline-error {
    position: absolute;
    right: 0;
    top: calc(100% + 0.35rem);
    z-index: 55;
    display: grid;
    grid-template-columns: auto minmax(10rem, 1fr) auto;
    align-items: center;
    gap: 0.45rem;
    width: min(22rem, 80vw);
    border: 1px solid rgba(239, 68, 68, 0.45);
    background: rgba(20, 8, 10, 0.96);
    color: var(--color-text);
    padding: 0.55rem;
    font-size: 0.76rem;
  }
  .inline-error button { border: 0; background: transparent; color: var(--color-text-muted); }
  .identify-review {
    position: fixed;
    inset: 0 0 0 auto;
    z-index: 70;
    display: flex;
    width: min(100vw, 520px);
    flex-direction: column;
    gap: 1rem;
    overflow: auto;
    border-left: 1px solid var(--color-border, #1c2235);
    background: rgba(9, 12, 18, 0.95);
    padding: 1rem;
    backdrop-filter: blur(18px);
  }
  .identify-review header, .identify-review footer { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
  .identify-review footer { position: sticky; bottom: -1rem; margin: auto -1rem -1rem; border-top: 1px solid var(--color-border, #1c2235); background: rgba(9, 12, 18, 0.96); padding: 1rem; }
  h2, h3 { margin: 0; letter-spacing: 0; }
  h2 { font-size: 1.05rem; }
  h3 { display: flex; align-items: center; gap: 0.45rem; font-size: 0.78rem; text-transform: uppercase; color: var(--color-text-muted); }
  section { display: grid; gap: 0.7rem; }
  .field-list { display: grid; gap: 0.45rem; }
  .field-list label { display: grid; grid-template-columns: auto 7rem minmax(0, 1fr); gap: 0.55rem; align-items: start; border: 1px solid var(--color-border, #1c2235); background: var(--color-surface-1, #0c1018); padding: 0.65rem; }
  .field-list input { width: 1rem; height: 1rem; accent-color: #c49a5a; }
  .field-list span { font-size: 0.78rem; color: var(--color-text); }
  .field-list small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .candidate-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr)); gap: 0.55rem; }
  .candidate-grid button { display: grid; gap: 0.4rem; border: 1px solid var(--color-border, #1c2235); background: var(--color-surface-1, #0c1018); color: var(--color-text); padding: 0.45rem; text-align: left; }
  .candidate-grid img { width: 100%; aspect-ratio: 2 / 3; object-fit: cover; }
  .image-group { display: grid; gap: 0.45rem; }
  .image-group > div { display: grid; grid-template-columns: repeat(auto-fill, minmax(5rem, 1fr)); gap: 0.45rem; }
  .image-group button { border: 1px solid var(--color-border, #1c2235); background: var(--color-surface-1, #0c1018); padding: 0.25rem; }
  .image-group button.active { border-color: rgba(196, 154, 90, 0.8); box-shadow: 0 0 16px rgba(196, 154, 90, 0.2); }
  .image-group img { width: 100%; aspect-ratio: 2 / 3; object-fit: cover; }
  .ghost-button { background: transparent; }
  .apply-button { border-color: rgba(196, 154, 90, 0.75); background: linear-gradient(135deg, rgba(196, 154, 90, 0.24), rgba(196, 154, 90, 0.1)); box-shadow: 0 0 18px rgba(196, 154, 90, 0.16); }
</style>
