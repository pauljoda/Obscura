<script lang="ts">
  import { onMount } from "svelte";
  import {
    AlertCircle,
    Check,
    ChevronLeft,
    ChevronRight,
    Image as ImageIcon,
    Loader2,
    ScanSearch,
    Sparkles,
    X,
  } from "@lucide/svelte";
  import { portal } from "$lib/actions/portal";
  import {
    applyIdentifyProposal,
    fetchIdentifyProviders,
    identifyEntity,
    type CreditPatch,
    type EntityMetadataProposal,
    type EntitySearchCandidate,
    type ImageCandidate,
    type PluginProvider,
  } from "$lib/api/identify";

  type LegacyEntityKind = "video_series" | "video_movie" | "video_episode" | "book";

  interface IdentifyTarget {
    entityKind: LegacyEntityKind | string;
    entityId: string;
    title: string;
    existingCreditNames?: string[];
  }

  interface Props {
    entityKind: LegacyEntityKind | string;
    entityId: string;
    title: string;
    label?: string;
    class?: string;
    entities?: IdentifyTarget[];
    existingCreditNames?: string[];
    onApplied?: () => void | Promise<void>;
  }

  let {
    entityKind,
    entityId,
    title,
    label = "Identify",
    class: className,
    entities,
    existingCreditNames = [],
    onApplied,
  }: Props = $props();

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

  let workflowOpen = $state(false);
  let providers = $state<PluginProvider[]>([]);
  let loadingProviders = $state(false);
  let providersLoaded = $state(false);
  let identifying = $state(false);
  let proposal = $state<EntityMetadataProposal | null>(null);
  let activeIndex = $state(0);
  let selectedProviderId = $state("");
  let selectedFields = $state<Record<string, boolean>>({});
  let selectedImages = $state<Record<string, string | null>>({});
  let selectedCredits = $state<Record<string, boolean>>({});
  let applying = $state(false);
  let error = $state<string | null>(null);

  const targets = $derived.by((): IdentifyTarget[] => {
    if (entities?.length) return entities;
    return [{ entityKind, entityId, title, existingCreditNames }];
  });
  const activeTarget = $derived(targets[Math.min(activeIndex, Math.max(0, targets.length - 1))]);
  const v2Kind = $derived(mapKind(activeTarget?.entityKind ?? entityKind));
  const installedProviders = $derived(
    providers.filter((provider) => provider.installed && provider.enabled),
  );
  const runnableProviders = $derived(
    installedProviders.filter((provider) => provider.missingAuthKeys.length === 0),
  );
  const selectedProvider = $derived.by(() =>
    installedProviders.find((provider) => provider.id === selectedProviderId) ?? null,
  );
  const hasTargets = $derived(targets.length > 0);
  const heroImage = $derived.by(() => {
    if (!proposal) return null;
    return selectedImages.backdrop ??
      firstImageUrl(proposal.images, "backdrop") ??
      firstImageUrl(proposal.images, "still") ??
      null;
  });

  onMount(() => {
    void loadProviders();
  });

  $effect(() => {
    if (!workflowOpen || typeof document === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  });

  async function loadProviders() {
    if (loadingProviders) return;
    loadingProviders = true;
    error = null;
    try {
      providers = await fetchIdentifyProviders(v2Kind);
    } catch (err) {
      error = readError(err);
    } finally {
      loadingProviders = false;
      providersLoaded = true;
    }
  }

  async function openWorkflow() {
    workflowOpen = true;
    proposal = null;
    selectedProviderId = "";
    selectedFields = {};
    selectedImages = {};
    selectedCredits = {};
    error = null;
    if (!providersLoaded) await loadProviders();
  }

  function closeWorkflow() {
    workflowOpen = false;
    proposal = null;
    selectedProviderId = "";
    selectedFields = {};
    selectedImages = {};
    selectedCredits = {};
    error = null;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && workflowOpen) closeWorkflow();
  }

  async function selectProvider(providerId: string) {
    selectedProviderId = providerId;
    proposal = null;
    selectedFields = {};
    selectedImages = {};
    selectedCredits = {};
    error = null;
    const provider = runnableProviders.find((row) => row.id === providerId);
    if (provider) await run(provider);
  }

  async function run(provider: PluginProvider, candidate?: EntitySearchCandidate) {
    if (!activeTarget) return;
    selectedProviderId = provider.id;
    identifying = true;
    error = null;
    try {
      const nextProposal = await identifyEntity(activeTarget.entityId, provider.id, candidate
        ? { externalIds: candidate.externalIds }
        : undefined);
      proposal = nextProposal;
      selectedFields = Object.fromEntries(fieldKeys.map((field) => [field, hasField(nextProposal, field)]));
      selectedImages = defaultImageSelection(nextProposal.images);
      selectedCredits = Object.fromEntries(
        nextProposal.patch.credits.map((credit, index) => [creditKey(credit, index), true]),
      );
    } catch (err) {
      error = readError(err);
    } finally {
      identifying = false;
    }
  }

  function rerunCandidate(candidate: EntitySearchCandidate) {
    if (!selectedProvider) return;
    void run(selectedProvider, candidate);
  }

  function toggleField(field: string) {
    selectedFields = { ...selectedFields, [field]: !selectedFields[field] };
  }

  function toggleCredit(key: string) {
    selectedCredits = { ...selectedCredits, [key]: !selectedCredits[key] };
  }

  async function apply(closeAfter = true) {
    if (!proposal || !activeTarget) return;
    applying = true;
    error = null;
    try {
      const fields = Object.entries(selectedFields)
        .filter(([, enabled]) => enabled)
        .map(([field]) => field);
      await applyIdentifyProposal(activeTarget.entityId, proposalForApply(proposal), fields, selectedImages);
      await onApplied?.();
      if (closeAfter || activeIndex >= targets.length - 1) closeWorkflow();
      else moveTo(activeIndex + 1);
    } catch (err) {
      error = readError(err);
    } finally {
      applying = false;
    }
  }

  function moveTo(index: number) {
    if (index < 0 || index >= targets.length) return;
    activeIndex = index;
    proposal = null;
    selectedFields = {};
    selectedImages = {};
    selectedCredits = {};
    error = null;
    if (selectedProvider) void run(selectedProvider);
  }

  function proposalForApply(result: EntityMetadataProposal): EntityMetadataProposal {
    const credits = result.patch.credits.filter((credit, index) =>
      selectedCredits[creditKey(credit, index)] !== false,
    );
    return {
      ...result,
      patch: {
        ...result.patch,
        credits,
      },
    };
  }

  function fieldValue(result: EntityMetadataProposal, field: string): string {
    const patch = result.patch;
    if (field === "title") return patch.title ?? "";
    if (field === "description") return patch.description ?? "";
    if (field === "externalIds") return entries(patch.externalIds).join(", ");
    if (field === "urls") return patch.urls.join(", ");
    if (field === "tags") return patch.tags.join(", ");
    if (field === "studio") return patch.studio ?? "";
    if (field === "credits") return `${patch.credits.length} credit${patch.credits.length === 1 ? "" : "s"}`;
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

  function creditKey(credit: CreditPatch, index: number): string {
    return `${credit.role}:${credit.name}:${credit.character ?? ""}:${index}`;
  }

  function creditState(credit: CreditPatch): "merge" | "new" {
    const names = activeTarget?.existingCreditNames ?? [];
    return names.some((name) => name.localeCompare(credit.name, undefined, { sensitivity: "accent" }) === 0)
      ? "merge"
      : "new";
  }

  function firstImageUrl(images: ImageCandidate[], kind: string): string | null {
    return images.find((image) => image.kind === kind)?.url ?? null;
  }

  function imageAspect(kind: string): "poster" | "wide" | "logo" {
    const normalized = kind.toLowerCase();
    if (normalized.includes("logo")) return "logo";
    if (normalized.includes("backdrop") || normalized.includes("still")) return "wide";
    return "poster";
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

<svelte:window onkeydown={handleKeydown} />

{#if installedProviders.length > 0}
  <button
    type="button"
    class={["identify-button", className]}
    disabled={!hasTargets || loadingProviders}
    onclick={() => void openWorkflow()}
  >
    {#if loadingProviders}
      <Loader2 class="h-4 w-4 animate-spin" />
    {:else}
      <ScanSearch class="h-4 w-4" />
    {/if}
    <span>{label}</span>
  </button>
{/if}

{#if workflowOpen}
  <div class="identify-modal" use:portal role="dialog" aria-modal="true" aria-label={`Identify ${activeTarget?.title ?? title}`}>
    <div class="modal-backdrop" aria-hidden="true"></div>
    <div class="modal-panel">
      <header class="modal-header">
        <div class="title-block">
          <p>Identify metadata</p>
          <h2>{activeTarget?.title ?? title}</h2>
          {#if targets.length > 1}
            <span>{activeIndex + 1} of {targets.length}</span>
          {/if}
        </div>

        <div class="header-actions">
          {#if targets.length > 1}
            <button type="button" class="icon-button" disabled={activeIndex === 0} onclick={() => moveTo(activeIndex - 1)} aria-label="Previous entity">
              <ChevronLeft class="h-4 w-4" />
            </button>
            <button type="button" class="icon-button" disabled={activeIndex >= targets.length - 1} onclick={() => moveTo(activeIndex + 1)} aria-label="Next entity">
              <ChevronRight class="h-4 w-4" />
            </button>
          {/if}
          <button type="button" class="icon-button" onclick={closeWorkflow} aria-label="Close identify review">
            <X class="h-4 w-4" />
          </button>
        </div>
      </header>

      <div class="provider-bar">
        <label>
          <span>Provider</span>
          <select
            value={selectedProviderId}
            disabled={loadingProviders || identifying || runnableProviders.length === 0}
            onchange={(event) => void selectProvider((event.currentTarget as HTMLSelectElement).value)}
          >
            <option value="">Select a plugin</option>
            {#each installedProviders as provider (provider.id)}
              <option value={provider.id} disabled={provider.missingAuthKeys.length > 0}>
                {provider.name}{provider.missingAuthKeys.length > 0 ? " (missing credentials)" : ""}
              </option>
            {/each}
          </select>
        </label>

        {#if selectedProvider}
          <div class="provider-meta">
            <span>{selectedProvider.id}</span>
            <span>v{selectedProvider.version}</span>
          </div>
        {/if}
      </div>

      <div class="modal-body">
        {#if error}
          <div class="error-box" role="alert">
            <AlertCircle class="h-4 w-4" />
            <span>{error}</span>
          </div>
        {/if}

        {#if loadingProviders}
          <div class="empty-state">
            <Loader2 class="h-5 w-5 animate-spin" />
            <span>Loading providers</span>
          </div>
        {:else if installedProviders.length === 0}
          <div class="empty-state">
            <AlertCircle class="h-5 w-5" />
            <span>No installed identify plugin supports this entity type.</span>
          </div>
        {:else if runnableProviders.length === 0}
          <div class="empty-state">
            <AlertCircle class="h-5 w-5" />
            <span>Installed identify plugins need credentials before they can run.</span>
          </div>
        {:else if identifying}
          <div class="empty-state">
            <Loader2 class="h-5 w-5 animate-spin" />
            <span>Identifying with {selectedProvider?.name ?? "provider"}</span>
          </div>
        {:else if !proposal}
          <div class="empty-state">
            <Sparkles class="h-6 w-6" />
            <span>Select a provider to start the review.</span>
          </div>
        {:else}
          <div class="review-grid">
            <article class="review-main">
              <div class="result-hero">
                {#if heroImage}
                  <img src={heroImage} alt="" />
                {:else}
                  <div class="hero-placeholder"><ImageIcon class="h-8 w-8" /></div>
                {/if}
                <div>
                  <p>{proposal.provider} · {proposal.matchReason ?? "match"}</p>
                  <h3>{proposal.patch.title ?? activeTarget?.title ?? title}</h3>
                  {#if proposal.patch.description}
                    <span>{proposal.patch.description}</span>
                  {/if}
                </div>
              </div>

              <section class="review-section">
                <div class="section-heading">
                  <h4>Fields</h4>
                  <span>{Object.values(selectedFields).filter(Boolean).length} selected</span>
                </div>
                <div class="field-grid">
                  {#each fieldKeys as field (field)}
                    {#if hasField(proposal, field)}
                      <button
                        type="button"
                        class:active={selectedFields[field]}
                        onclick={() => toggleField(field)}
                      >
                        <Check class="h-3.5 w-3.5" />
                        <span>{fieldLabels[field]}</span>
                        <small>{fieldValue(proposal, field)}</small>
                      </button>
                    {/if}
                  {/each}
                </div>
              </section>

              {#if proposal.patch.tags.length > 0}
                <section class="review-section" class:muted={!selectedFields.tags}>
                  <div class="section-heading">
                    <h4>Tags</h4>
                    <button type="button" onclick={() => toggleField("tags")}>
                      {selectedFields.tags ? "Included" : "Excluded"}
                    </button>
                  </div>
                  <div class="chip-row">
                    {#each proposal.patch.tags as tag (tag)}
                      <span>{tag}</span>
                    {/each}
                  </div>
                </section>
              {/if}

              {#if proposal.patch.credits.length > 0}
                <section class="review-section" class:muted={!selectedFields.credits}>
                  <div class="section-heading">
                    <h4>Credits</h4>
                    <button type="button" onclick={() => toggleField("credits")}>
                      {selectedFields.credits ? "Included" : "Excluded"}
                    </button>
                  </div>
                  <div class="credit-grid">
                    {#each proposal.patch.credits as credit, index (creditKey(credit, index))}
                      {@const key = creditKey(credit, index)}
                      {@const state = creditState(credit)}
                      <button
                        type="button"
                        class:active={selectedCredits[key] !== false}
                        onclick={() => toggleCredit(key)}
                      >
                        <span class="credit-avatar">{credit.name.slice(0, 1)}</span>
                        <span class="credit-copy">
                          <strong>{credit.name}</strong>
                          <small>{credit.character ? `${credit.role} · ${credit.character}` : credit.role}</small>
                        </span>
                        <em>{state === "merge" ? "Merge" : "New"}</em>
                      </button>
                    {/each}
                  </div>
                </section>
              {/if}
            </article>

            <aside class="review-side">
              {#if proposal.candidates.length > 1}
                <section class="review-section">
                  <div class="section-heading">
                    <h4>Candidates</h4>
                    <span>{proposal.candidates.length}</span>
                  </div>
                  <div class="candidate-list">
                    {#each proposal.candidates as candidate (candidate.externalIds.tmdb ?? candidate.title)}
                      <button type="button" onclick={() => rerunCandidate(candidate)}>
                        {#if candidate.posterUrl}
                          <img src={candidate.posterUrl} alt="" />
                        {/if}
                        <span>
                          <strong>{candidate.title}</strong>
                          <small>{candidate.year ?? "Unknown year"}</small>
                        </span>
                      </button>
                    {/each}
                  </div>
                </section>
              {/if}

              {#if proposal.images.length > 0}
                <section class="review-section">
                  <div class="section-heading">
                    <h4>Artwork</h4>
                    <button type="button" onclick={() => toggleField("images")}>
                      {selectedFields.images ? "Included" : "Excluded"}
                    </button>
                  </div>
                  {#each imageGroups(proposal.images) as group (group.kind)}
                    <div class="image-group" data-aspect={imageAspect(group.kind)}>
                      <p>{group.kind}</p>
                      <div>
                        {#each group.images as image (image.url)}
                          <button
                            type="button"
                            class:active={selectedImages[group.kind] === image.url}
                            onclick={() => (selectedImages = { ...selectedImages, [group.kind]: image.url })}
                            title={`${image.width ?? "?"}x${image.height ?? "?"}`}
                          >
                            <img src={image.url} alt="" />
                            <small>{image.width && image.height ? `${image.width}x${image.height}` : image.source}</small>
                          </button>
                        {/each}
                      </div>
                    </div>
                  {/each}
                </section>
              {/if}
            </aside>
          </div>
        {/if}
      </div>

      <footer class="modal-footer">
        <button type="button" class="ghost-button" onclick={closeWorkflow}>Cancel</button>
        <div>
          {#if targets.length > 1 && proposal}
            <button type="button" class="ghost-button" disabled={applying} onclick={() => void apply(false)}>
              Apply & next
            </button>
          {/if}
          <button type="button" class="apply-button" disabled={!proposal || applying} onclick={() => void apply(true)}>
            {#if applying}
              <Loader2 class="h-4 w-4 animate-spin" />
              Applying
            {:else}
              <Check class="h-4 w-4" />
              Apply
            {/if}
          </button>
        </div>
      </footer>
    </div>
  </div>
{/if}

<style>
  button,
  select {
    border-radius: 0;
  }

  button {
    cursor: pointer;
  }

  button:disabled,
  select:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .identify-button {
    display: inline-flex;
    min-height: 2.1rem;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    border: 1px solid rgba(196, 154, 90, 0.55);
    background: var(--color-surface-2, #111827);
    color: var(--color-text);
    padding: 0 0.65rem;
    font-size: 0.76rem;
    box-shadow: 0 0 14px rgba(196, 154, 90, 0.12);
  }

  .identify-modal {
    position: fixed;
    inset: 0;
    z-index: 1500;
    display: flex;
    isolation: isolate;
    background: rgba(4, 5, 8, 0.86);
  }

  .modal-backdrop {
    position: absolute;
    inset: 0;
    z-index: 0;
    background:
      linear-gradient(135deg, rgba(196, 154, 90, 0.08), transparent 34%),
      rgba(4, 5, 8, 0.9);
  }

  .modal-panel {
    position: relative;
    z-index: 1;
    display: flex;
    width: 100%;
    height: 100dvh;
    max-height: 100dvh;
    flex-direction: column;
    border: 1px solid var(--color-border, #1c2235);
    background: rgb(10, 12, 17);
    color: var(--color-text);
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6);
  }

  .modal-header,
  .provider-bar,
  .modal-footer {
    flex-shrink: 0;
    border-color: var(--color-border, #1c2235);
    background: rgba(12, 15, 21, 0.96);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    border-bottom: 1px solid var(--color-border, #1c2235);
    padding: 0.85rem 1rem;
  }

  .title-block {
    min-width: 0;
  }

  .title-block p,
  .title-block span,
  .provider-bar span,
  small,
  .result-hero p,
  .result-hero span,
  .image-group p {
    margin: 0;
    color: var(--color-text-muted);
  }

  .title-block p,
  .provider-bar label > span,
  .section-heading h4,
  .image-group p {
    font-size: 0.62rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .title-block h2,
  .result-hero h3,
  .section-heading h4 {
    margin: 0;
    letter-spacing: 0;
  }

  .title-block h2 {
    overflow: hidden;
    color: var(--color-text-primary);
    font-size: 1rem;
    font-weight: 650;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .header-actions,
  .modal-footer > div,
  .provider-meta {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  .icon-button,
  .ghost-button,
  .apply-button {
    display: inline-flex;
    min-height: 2rem;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-2, #111827);
    color: var(--color-text);
    padding: 0 0.7rem;
    font-size: 0.72rem;
  }

  .icon-button {
    width: 2rem;
    padding: 0;
  }

  .provider-bar {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 1rem;
    border-bottom: 1px solid var(--color-border, #1c2235);
    padding: 0.75rem 1rem;
  }

  .provider-bar label {
    display: grid;
    min-width: min(20rem, 100%);
    gap: 0.35rem;
  }

  .provider-bar select {
    min-height: 2.25rem;
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-1, #0c1018);
    color: var(--color-text);
    padding: 0 2rem 0 0.65rem;
    font-size: 0.78rem;
  }

  .modal-body {
    min-height: 0;
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
  }

  .empty-state,
  .error-box {
    display: flex;
    min-height: 12rem;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    border: 1px solid var(--color-border, #1c2235);
    background: rgba(12, 15, 21, 0.72);
    color: var(--color-text-muted);
    font-size: 0.82rem;
  }

  .error-box {
    min-height: auto;
    justify-content: flex-start;
    border-color: rgba(239, 68, 68, 0.45);
    background: rgba(20, 8, 10, 0.9);
    color: var(--color-status-error-text, #fecaca);
    padding: 0.7rem;
  }

  .review-grid {
    display: grid;
    gap: 1rem;
  }

  .review-main,
  .review-side,
  .review-section {
    display: grid;
    gap: 0.8rem;
    min-width: 0;
  }

  .result-hero,
  .review-section {
    border: 1px solid var(--color-border, #1c2235);
    background: rgba(12, 15, 21, 0.78);
  }

  .result-hero {
    overflow: hidden;
  }

  .result-hero > img,
  .hero-placeholder {
    display: block;
    width: 100%;
    aspect-ratio: 16 / 9;
    background: var(--color-surface-2, #111827);
    object-fit: cover;
  }

  .hero-placeholder {
    display: grid;
    place-items: center;
    color: var(--color-text-disabled);
  }

  .result-hero > div {
    display: grid;
    gap: 0.35rem;
    padding: 0.9rem;
  }

  .result-hero h3 {
    color: var(--color-text-primary);
    font-size: 1.25rem;
  }

  .result-hero span {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    line-height: 1.5;
  }

  .review-section {
    padding: 0.85rem;
  }

  .review-section.muted {
    opacity: 0.48;
  }

  .section-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    color: var(--color-text-muted);
  }

  .section-heading button,
  .section-heading span {
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-1, #0c1018);
    color: var(--color-text-muted);
    padding: 0.25rem 0.5rem;
    font-size: 0.62rem;
  }

  .field-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    gap: 0.55rem;
  }

  .field-grid button {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.25rem 0.45rem;
    align-items: start;
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-1, #0c1018);
    color: var(--color-text-muted);
    padding: 0.6rem;
    text-align: left;
  }

  .field-grid button.active {
    border-color: rgba(196, 154, 90, 0.58);
    color: var(--color-text-primary);
    box-shadow: 0 0 16px rgba(196, 154, 90, 0.12);
  }

  .field-grid small {
    grid-column: 2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chip-row,
  .credit-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
  }

  .chip-row span {
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-1, #0c1018);
    color: var(--color-text-muted);
    padding: 0.25rem 0.5rem;
    font-size: 0.65rem;
  }

  .credit-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  }

  .credit-grid button {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 0.6rem;
    align-items: center;
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-1, #0c1018);
    color: var(--color-text-muted);
    padding: 0.55rem;
    text-align: left;
  }

  .credit-grid button.active {
    border-color: rgba(196, 154, 90, 0.58);
    color: var(--color-text-primary);
  }

  .credit-avatar {
    display: grid;
    width: 2rem;
    height: 2rem;
    place-items: center;
    border: 1px solid var(--color-border, #1c2235);
    background: linear-gradient(135deg, rgba(196, 154, 90, 0.22), rgba(255, 255, 255, 0.04));
    color: var(--color-text-primary);
    font-size: 0.74rem;
    text-transform: uppercase;
  }

  .credit-copy {
    display: grid;
    min-width: 0;
  }

  .credit-copy strong,
  .candidate-list strong {
    overflow: hidden;
    font-size: 0.76rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .credit-copy small,
  .candidate-list small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .credit-grid em {
    border: 1px solid rgba(196, 154, 90, 0.35);
    color: var(--color-text-accent);
    padding: 0.18rem 0.4rem;
    font-size: 0.58rem;
    font-style: normal;
    text-transform: uppercase;
  }

  .candidate-list {
    display: grid;
    gap: 0.5rem;
  }

  .candidate-list button {
    display: grid;
    grid-template-columns: 2.4rem minmax(0, 1fr);
    gap: 0.6rem;
    align-items: center;
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-1, #0c1018);
    color: var(--color-text-primary);
    padding: 0.45rem;
    text-align: left;
  }

  .candidate-list img {
    width: 2.4rem;
    aspect-ratio: 2 / 3;
    object-fit: cover;
  }

  .candidate-list span {
    display: grid;
    min-width: 0;
  }

  .image-group {
    display: grid;
    gap: 0.4rem;
  }

  .image-group > div {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.45rem;
  }

  .image-group button {
    position: relative;
    overflow: hidden;
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-1, #0c1018);
    padding: 0;
  }

  .image-group button.active {
    border-color: rgba(196, 154, 90, 0.8);
    box-shadow: 0 0 16px rgba(196, 154, 90, 0.18);
  }

  .image-group img {
    display: block;
    width: 100%;
    object-fit: cover;
  }

  .image-group[data-aspect="poster"] img {
    aspect-ratio: 2 / 3;
  }

  .image-group[data-aspect="wide"] img {
    aspect-ratio: 16 / 9;
  }

  .image-group[data-aspect="logo"] img {
    aspect-ratio: 16 / 5;
    object-fit: contain;
    padding: 0.5rem;
  }

  .image-group small {
    position: absolute;
    inset: auto 0 0;
    background: rgba(5, 6, 9, 0.78);
    padding: 0.2rem 0.3rem;
    font-size: 0.55rem;
    text-align: left;
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    border-top: 1px solid var(--color-border, #1c2235);
    padding: 0.8rem 1rem;
  }

  .ghost-button {
    background: transparent;
    color: var(--color-text-muted);
  }

  .apply-button {
    border-color: rgba(196, 154, 90, 0.78);
    background: linear-gradient(135deg, rgba(196, 154, 90, 0.26), rgba(196, 154, 90, 0.1));
    box-shadow: 0 0 18px rgba(196, 154, 90, 0.16);
  }

  @media (min-width: 840px) {
    .identify-modal {
      padding: 1.2rem;
    }

    .modal-panel {
      max-width: 1180px;
      height: calc(100dvh - 2.4rem);
      margin: auto;
      max-height: none;
    }

    .review-grid {
      grid-template-columns: minmax(0, 1fr) minmax(18rem, 26rem);
      align-items: start;
    }
  }

  @media (max-width: 839px) {
    .modal-panel {
      min-height: 100dvh;
      border: 0;
    }

    .provider-bar,
    .modal-footer,
    .modal-footer > div {
      align-items: stretch;
      flex-direction: column;
    }

    .provider-bar label,
    .modal-footer button {
      width: 100%;
    }

    .modal-body {
      padding: 0.75rem;
    }

    .image-group > div {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
