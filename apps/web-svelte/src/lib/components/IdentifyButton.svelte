<script lang="ts">
  import { onMount } from "svelte";
  import {
    AlertCircle,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Eye,
    Image as ImageIcon,
    Loader2,
    ScanSearch,
    Sparkles,
    User,
    X,
    Zap,
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
  let expandedSections = $state<Record<string, boolean>>({ fields: true, tags: true, credits: true, artwork: true, candidates: true });

  function toggleSection(section: string) {
    expandedSections = { ...expandedSections, [section]: !expandedSections[section] };
  }

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
      <!-- Header -->
      <header class="modal-header">
        <div class="header-left">
          <div class="header-icon">
            <ScanSearch class="h-4 w-4" />
          </div>
          <div class="title-block">
            <p>Identify</p>
            <h2>{activeTarget?.title ?? title}</h2>
          </div>
        </div>

        <div class="header-actions">
          {#if targets.length > 1}
            <div class="nav-pill">
              <button type="button" class="nav-btn" disabled={activeIndex === 0} onclick={() => moveTo(activeIndex - 1)} aria-label="Previous entity">
                <ChevronLeft class="h-3.5 w-3.5" />
              </button>
              <span class="nav-count">{activeIndex + 1}/{targets.length}</span>
              <button type="button" class="nav-btn" disabled={activeIndex >= targets.length - 1} onclick={() => moveTo(activeIndex + 1)} aria-label="Next entity">
                <ChevronRight class="h-3.5 w-3.5" />
              </button>
            </div>
          {/if}
          <button type="button" class="close-btn" onclick={closeWorkflow} aria-label="Close">
            <X class="h-4 w-4" />
          </button>
        </div>
      </header>

      <!-- Provider strip -->
      <div class="provider-strip">
        {#if loadingProviders}
          <div class="provider-loading">
            <Loader2 class="h-3.5 w-3.5 animate-spin" />
            <span>Loading providers…</span>
          </div>
        {:else}
          <div class="provider-cards">
            {#each installedProviders as provider (provider.id)}
              {@const isActive = selectedProviderId === provider.id}
              {@const disabled = provider.missingAuthKeys.length > 0}
              <button
                type="button"
                class="provider-card"
                class:active={isActive}
                class:disabled
                disabled={disabled || identifying}
                onclick={() => void selectProvider(provider.id)}
              >
                <Zap class="h-3.5 w-3.5" />
                <span class="provider-name">{provider.name}</span>
                {#if disabled}
                  <span class="provider-badge missing">Auth needed</span>
                {:else if isActive && proposal}
                  <span class="provider-badge matched">Matched</span>
                {/if}
              </button>
            {/each}
          </div>
          {#if selectedProvider}
            <div class="provider-info">
              <span>{selectedProvider.id}</span>
              <span>v{selectedProvider.version}</span>
            </div>
          {/if}
        {/if}
      </div>

      <!-- Body -->
      <div class="modal-body">
        {#if error}
          <div class="error-box" role="alert">
            <AlertCircle class="h-4 w-4" />
            <span>{error}</span>
          </div>
        {/if}

        {#if installedProviders.length === 0 && !loadingProviders}
          <div class="empty-state">
            <div class="empty-icon"><AlertCircle class="h-6 w-6" /></div>
            <h3>No plugins available</h3>
            <p>No installed identify plugin supports this entity type.</p>
          </div>
        {:else if runnableProviders.length === 0 && !loadingProviders}
          <div class="empty-state">
            <div class="empty-icon"><AlertCircle class="h-6 w-6" /></div>
            <h3>Credentials required</h3>
            <p>Installed identify plugins need credentials before they can run.</p>
          </div>
        {:else if identifying}
          <div class="empty-state loading">
            <div class="scan-animation">
              <Loader2 class="h-6 w-6 animate-spin" />
            </div>
            <h3>Identifying…</h3>
            <p>Searching with {selectedProvider?.name ?? "provider"}</p>
          </div>
        {:else if !proposal && !loadingProviders}
          <div class="empty-state">
            <div class="empty-icon sparkle"><Sparkles class="h-6 w-6" /></div>
            <h3>Ready to identify</h3>
            <p>Select a provider above to search for metadata.</p>
          </div>
        {:else if proposal}
          <div class="review-layout">
            <!-- Hero card -->
            <div class="hero-card">
              <div class="hero-visual">
                {#if heroImage}
                  <img src={heroImage} alt="" class="hero-img" />
                  <div class="hero-gradient"></div>
                {:else}
                  <div class="hero-placeholder"><ImageIcon class="h-10 w-10" /></div>
                {/if}
              </div>
              <div class="hero-content">
                <div class="hero-meta">
                  <span class="match-badge">
                    <Eye class="h-3 w-3" />
                    {proposal.matchReason ?? "match"}
                  </span>
                  <span class="provider-tag">{proposal.provider}</span>
                </div>
                <h3 class="hero-title">{proposal.patch.title ?? activeTarget?.title ?? title}</h3>
                {#if proposal.patch.description}
                  <p class="hero-desc">{proposal.patch.description}</p>
                {/if}
              </div>
            </div>

            <!-- Review content -->
            <div class="review-content">
              <!-- Fields section -->
              <section class="section-card">
                <div class="section-header" role="button" tabindex="0" onclick={() => toggleSection('fields')} onkeydown={(e) => e.key === 'Enter' && toggleSection('fields')}>
                  <h4>Fields</h4>
                  <div class="section-meta">
                    <span class="count-badge">{Object.values(selectedFields).filter(Boolean).length} selected</span>
                    <span class="chevron" class:rotated={!expandedSections.fields}><ChevronDown class="h-3.5 w-3.5" /></span>
                  </div>
                </div>
                {#if expandedSections.fields}
                  <div class="section-body">
                    <div class="field-grid">
                      {#each fieldKeys as field (field)}
                        {#if hasField(proposal, field)}
                          <button
                            type="button"
                            class="field-card"
                            class:active={selectedFields[field]}
                            onclick={() => toggleField(field)}
                          >
                            <div class="field-check">
                              {#if selectedFields[field]}
                                <Check class="h-3 w-3" />
                              {/if}
                            </div>
                            <div class="field-info">
                              <span class="field-label">{fieldLabels[field]}</span>
                              <span class="field-value">{fieldValue(proposal, field)}</span>
                            </div>
                          </button>
                        {/if}
                      {/each}
                    </div>
                  </div>
                {/if}
              </section>

              <!-- Tags section -->
              {#if proposal.patch.tags.length > 0}
                <section class="section-card" class:muted={!selectedFields.tags}>
                  <div class="section-header" role="button" tabindex="0" onclick={() => toggleSection('tags')} onkeydown={(e) => e.key === 'Enter' && toggleSection('tags')}>
                    <h4>Tags</h4>
                    <div class="section-meta">
                      <button
                        type="button"
                        class="toggle-pill"
                        class:included={selectedFields.tags}
                        onclick={(e) => { e.stopPropagation(); toggleField("tags"); }}
                      >
                        {selectedFields.tags ? "Included" : "Excluded"}
                      </button>
                      <span class="chevron" class:rotated={!expandedSections.tags}><ChevronDown class="h-3.5 w-3.5" /></span>
                    </div>
                  </div>
                  {#if expandedSections.tags}
                    <div class="section-body">
                      <div class="tag-cloud">
                        {#each proposal.patch.tags as tag (tag)}
                          <span class="tag-chip">{tag}</span>
                        {/each}
                      </div>
                    </div>
                  {/if}
                </section>
              {/if}

              <!-- Credits section -->
              {#if proposal.patch.credits.length > 0}
                <section class="section-card" class:muted={!selectedFields.credits}>
                  <div class="section-header" role="button" tabindex="0" onclick={() => toggleSection('credits')} onkeydown={(e) => e.key === 'Enter' && toggleSection('credits')}>
                    <h4>Credits</h4>
                    <div class="section-meta">
                      <button
                        type="button"
                        class="toggle-pill"
                        class:included={selectedFields.credits}
                        onclick={(e) => { e.stopPropagation(); toggleField("credits"); }}
                      >
                        {selectedFields.credits ? "Included" : "Excluded"}
                      </button>
                      <span class="count-badge">{proposal.patch.credits.length}</span>
                      <span class="chevron" class:rotated={!expandedSections.credits}><ChevronDown class="h-3.5 w-3.5" /></span>
                    </div>
                  </div>
                  {#if expandedSections.credits}
                    <div class="section-body">
                      <div class="credit-grid">
                        {#each proposal.patch.credits as credit, index (creditKey(credit, index))}
                          {@const key = creditKey(credit, index)}
                          {@const state = creditState(credit)}
                          <button
                            type="button"
                            class="credit-card"
                            class:active={selectedCredits[key] !== false}
                            onclick={() => toggleCredit(key)}
                          >
                            <div class="credit-avatar">
                              <User class="h-3.5 w-3.5" />
                            </div>
                            <div class="credit-info">
                              <strong>{credit.name}</strong>
                              <small>{credit.character ? `${credit.role} · ${credit.character}` : credit.role}</small>
                            </div>
                            <span class="credit-state" class:merge={state === "merge"}>{state === "merge" ? "Merge" : "New"}</span>
                          </button>
                        {/each}
                      </div>
                    </div>
                  {/if}
                </section>
              {/if}

              <!-- Artwork section -->
              {#if proposal.images.length > 0}
                <section class="section-card" class:muted={!selectedFields.images}>
                  <div class="section-header" role="button" tabindex="0" onclick={() => toggleSection('artwork')} onkeydown={(e) => e.key === 'Enter' && toggleSection('artwork')}>
                    <h4>Artwork</h4>
                    <div class="section-meta">
                      <button
                        type="button"
                        class="toggle-pill"
                        class:included={selectedFields.images}
                        onclick={(e) => { e.stopPropagation(); toggleField("images"); }}
                      >
                        {selectedFields.images ? "Included" : "Excluded"}
                      </button>
                      <span class="count-badge">{proposal.images.length}</span>
                      <span class="chevron" class:rotated={!expandedSections.artwork}><ChevronDown class="h-3.5 w-3.5" /></span>
                    </div>
                  </div>
                  {#if expandedSections.artwork}
                    <div class="section-body">
                      {#each imageGroups(proposal.images) as group (group.kind)}
                        <div class="image-group" data-aspect={imageAspect(group.kind)}>
                          <div class="image-group-header">
                            <span>{group.kind}</span>
                            <span class="image-count">{group.images.length}</span>
                          </div>
                          <div class="image-grid">
                            {#each group.images as image (image.url)}
                              <button
                                type="button"
                                class="image-card"
                                class:active={selectedImages[group.kind] === image.url}
                                onclick={() => (selectedImages = { ...selectedImages, [group.kind]: image.url })}
                                title={`${image.width ?? "?"}x${image.height ?? "?"}`}
                              >
                                <img src={image.url} alt="" />
                                {#if selectedImages[group.kind] === image.url}
                                  <div class="image-selected-badge"><Check class="h-3 w-3" /></div>
                                {/if}
                                <span class="image-dim">{image.width && image.height ? `${image.width}×${image.height}` : image.source}</span>
                              </button>
                            {/each}
                          </div>
                        </div>
                      {/each}
                    </div>
                  {/if}
                </section>
              {/if}
            </div>

            <!-- Sidebar: Candidates -->
            {#if proposal.candidates.length > 1}
              <aside class="candidates-panel">
                <div class="section-header" role="button" tabindex="0" onclick={() => toggleSection('candidates')} onkeydown={(e) => e.key === 'Enter' && toggleSection('candidates')}>
                  <h4>Other matches</h4>
                  <div class="section-meta">
                    <span class="count-badge">{proposal.candidates.length}</span>
                    <span class="chevron" class:rotated={!expandedSections.candidates}><ChevronDown class="h-3.5 w-3.5" /></span>
                  </div>
                </div>
                {#if expandedSections.candidates}
                  <div class="candidate-list">
                    {#each proposal.candidates as candidate (candidate.externalIds.tmdb ?? candidate.title)}
                      <button type="button" class="candidate-card" onclick={() => rerunCandidate(candidate)}>
                        {#if candidate.posterUrl}
                          <img src={candidate.posterUrl} alt="" class="candidate-poster" />
                        {:else}
                          <div class="candidate-poster-placeholder"><ImageIcon class="h-4 w-4" /></div>
                        {/if}
                        <div class="candidate-info">
                          <strong>{candidate.title}</strong>
                          <small>{candidate.year ?? "Unknown year"}</small>
                        </div>
                        <ChevronRight class="h-3.5 w-3.5 candidate-arrow" />
                      </button>
                    {/each}
                  </div>
                {/if}
              </aside>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <footer class="modal-footer">
        <button type="button" class="btn-ghost" onclick={closeWorkflow}>Cancel</button>
        <div class="footer-actions">
          {#if targets.length > 1 && proposal}
            <button type="button" class="btn-secondary" disabled={applying} onclick={() => void apply(false)}>
              Apply & next
              <ChevronRight class="h-3.5 w-3.5" />
            </button>
          {/if}
          <button type="button" class="btn-primary" disabled={!proposal || applying} onclick={() => void apply(true)}>
            {#if applying}
              <Loader2 class="h-4 w-4 animate-spin" />
              Applying…
            {:else}
              <Check class="h-4 w-4" />
              Apply changes
            {/if}
          </button>
        </div>
      </footer>
    </div>
  </div>
{/if}

<style>
  /* === Base resets === */
  button, select { border-radius: 0; }
  button { cursor: pointer; }
  button:disabled, select:disabled { cursor: not-allowed; opacity: 0.5; }

  /* === Trigger button === */
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
    transition: box-shadow 0.2s, border-color 0.2s;
  }
  .identify-button:hover:not(:disabled) {
    border-color: rgba(196, 154, 90, 0.8);
    box-shadow: 0 0 20px rgba(196, 154, 90, 0.22);
  }

  /* === Modal shell === */
  .identify-modal {
    position: fixed;
    inset: 0;
    z-index: 1500;
    display: flex;
    isolation: isolate;
    animation: modal-in 0.25s ease-out;
  }

  @keyframes modal-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .modal-backdrop {
    position: absolute;
    inset: 0;
    z-index: 0;
    background:
      radial-gradient(ellipse at 30% 20%, rgba(196, 154, 90, 0.06) 0%, transparent 50%),
      rgba(4, 5, 8, 0.92);
    backdrop-filter: blur(4px);
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
    background: linear-gradient(180deg, rgb(12, 15, 21) 0%, rgb(8, 10, 15) 100%);
    color: var(--color-text);
    box-shadow: 0 32px 100px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.03);
    animation: panel-in 0.3s ease-out;
  }

  @keyframes panel-in {
    from { opacity: 0; transform: scale(0.97) translateY(8px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }

  /* === Header === */
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-shrink: 0;
    border-bottom: 1px solid var(--color-border, #1c2235);
    background: rgba(12, 15, 21, 0.97);
    padding: 0.75rem 1rem;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
  }

  .header-icon {
    display: grid;
    width: 2rem;
    height: 2rem;
    flex-shrink: 0;
    place-items: center;
    border: 1px solid rgba(196, 154, 90, 0.4);
    background: linear-gradient(135deg, rgba(196, 154, 90, 0.15), rgba(196, 154, 90, 0.05));
    color: var(--color-text-accent, #c49a5a);
    box-shadow: 0 0 12px rgba(196, 154, 90, 0.1);
  }

  .title-block { min-width: 0; }
  .title-block p {
    margin: 0;
    color: var(--color-text-muted, #8a93a6);
    font-size: 0.6rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  .title-block h2 {
    margin: 0;
    overflow: hidden;
    color: var(--color-text-primary, #f2eed8);
    font-size: 1rem;
    font-weight: 650;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .nav-pill {
    display: flex;
    align-items: center;
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-1, #0c0f15);
  }
  .nav-btn {
    display: grid;
    width: 1.75rem;
    height: 1.75rem;
    place-items: center;
    border: none;
    background: transparent;
    color: var(--color-text-muted, #8a93a6);
    transition: color 0.15s, background 0.15s;
  }
  .nav-btn:hover:not(:disabled) {
    color: var(--color-text-primary, #f2eed8);
    background: rgba(255, 255, 255, 0.04);
  }
  .nav-count {
    padding: 0 0.35rem;
    color: var(--color-text-muted, #8a93a6);
    font-family: "JetBrains Mono", monospace;
    font-size: 0.65rem;
  }

  .close-btn {
    display: grid;
    width: 2rem;
    height: 2rem;
    place-items: center;
    border: 1px solid var(--color-border, #1c2235);
    background: transparent;
    color: var(--color-text-muted, #8a93a6);
    transition: color 0.15s, border-color 0.15s, background 0.15s;
  }
  .close-btn:hover {
    color: var(--color-text-primary, #f2eed8);
    border-color: rgba(168, 72, 80, 0.5);
    background: rgba(168, 72, 80, 0.1);
  }

  /* === Provider strip === */
  .provider-strip {
    flex-shrink: 0;
    border-bottom: 1px solid var(--color-border, #1c2235);
    background: rgba(10, 12, 17, 0.95);
    padding: 0.6rem 1rem;
  }

  .provider-loading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--color-text-muted, #8a93a6);
    font-size: 0.72rem;
  }

  .provider-cards {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .provider-card {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-1, #0c0f15);
    color: var(--color-text-muted, #8a93a6);
    padding: 0.4rem 0.65rem;
    font-size: 0.7rem;
    transition: all 0.2s;
  }
  .provider-card:hover:not(:disabled) {
    border-color: rgba(196, 154, 90, 0.4);
    color: var(--color-text-primary, #f2eed8);
    background: rgba(196, 154, 90, 0.06);
  }
  .provider-card.active {
    border-color: rgba(196, 154, 90, 0.6);
    color: var(--color-text-primary, #f2eed8);
    background: linear-gradient(135deg, rgba(196, 154, 90, 0.12), rgba(196, 154, 90, 0.04));
    box-shadow: 0 0 16px rgba(196, 154, 90, 0.12);
  }
  .provider-card.disabled {
    opacity: 0.4;
  }

  .provider-name { font-weight: 500; }

  .provider-badge {
    padding: 0.1rem 0.35rem;
    font-size: 0.55rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .provider-badge.missing {
    border: 1px solid rgba(168, 72, 80, 0.4);
    color: var(--color-status-error-text, #cc7880);
  }
  .provider-badge.matched {
    border: 1px solid rgba(78, 138, 98, 0.4);
    color: var(--color-status-success-text, #80b898);
  }

  .provider-info {
    display: flex;
    gap: 0.6rem;
    margin-top: 0.4rem;
    color: var(--color-text-disabled, #4a5260);
    font-family: "JetBrains Mono", monospace;
    font-size: 0.6rem;
  }

  /* === Body === */
  .modal-body {
    min-height: 0;
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    scrollbar-width: thin;
    scrollbar-color: rgba(196, 154, 90, 0.2) transparent;
  }

  /* === Empty states === */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    min-height: 16rem;
    text-align: center;
  }
  .empty-state h3 {
    margin: 0;
    color: var(--color-text-primary, #f2eed8);
    font-size: 0.9rem;
    font-weight: 600;
  }
  .empty-state p {
    margin: 0;
    color: var(--color-text-muted, #8a93a6);
    font-size: 0.78rem;
  }
  .empty-icon {
    display: grid;
    width: 3rem;
    height: 3rem;
    place-items: center;
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-1, #0c0f15);
    color: var(--color-text-disabled, #4a5260);
  }
  .empty-icon.sparkle {
    border-color: rgba(196, 154, 90, 0.3);
    color: var(--color-text-accent, #c49a5a);
    box-shadow: 0 0 20px rgba(196, 154, 90, 0.1);
  }

  .scan-animation {
    display: grid;
    width: 3.5rem;
    height: 3.5rem;
    place-items: center;
    border: 1px solid rgba(196, 154, 90, 0.3);
    background: linear-gradient(135deg, rgba(196, 154, 90, 0.08), transparent);
    color: var(--color-text-accent, #c49a5a);
    box-shadow: 0 0 24px rgba(196, 154, 90, 0.15);
    animation: pulse-glow 2s ease-in-out infinite;
  }

  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 16px rgba(196, 154, 90, 0.1); }
    50% { box-shadow: 0 0 32px rgba(196, 154, 90, 0.25); }
  }

  .error-box {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 0.75rem;
    border: 1px solid rgba(168, 72, 80, 0.4);
    background: rgba(90, 44, 48, 0.15);
    color: var(--color-status-error-text, #cc7880);
    padding: 0.7rem 0.85rem;
    font-size: 0.76rem;
  }

  /* === Review layout === */
  .review-layout {
    display: grid;
    gap: 0.85rem;
  }

  /* === Hero card === */
  .hero-card {
    position: relative;
    overflow: hidden;
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-1, #0c0f15);
  }

  .hero-visual {
    position: relative;
    width: 100%;
    aspect-ratio: 21 / 9;
    overflow: hidden;
    background: var(--color-surface-2, #101420);
  }
  .hero-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .hero-gradient {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgb(12, 15, 21) 0%, rgba(12, 15, 21, 0.6) 40%, transparent 70%);
  }
  .hero-placeholder {
    display: grid;
    width: 100%;
    height: 100%;
    place-items: center;
    color: var(--color-text-disabled, #4a5260);
  }

  .hero-content {
    padding: 1rem 1.1rem;
  }

  .hero-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .match-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    border: 1px solid rgba(78, 138, 98, 0.4);
    background: rgba(42, 74, 56, 0.3);
    color: var(--color-status-success-text, #80b898);
    padding: 0.2rem 0.5rem;
    font-size: 0.6rem;
    text-transform: capitalize;
  }

  .provider-tag {
    color: var(--color-text-disabled, #4a5260);
    font-family: "JetBrains Mono", monospace;
    font-size: 0.6rem;
  }

  .hero-title {
    margin: 0;
    color: var(--color-text-primary, #f2eed8);
    font-size: 1.35rem;
    font-weight: 700;
    line-height: 1.25;
  }

  .hero-desc {
    display: -webkit-box;
    overflow: hidden;
    margin: 0.45rem 0 0;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    color: var(--color-text-secondary, #c4c9d4);
    font-size: 0.78rem;
    line-height: 1.55;
  }

  /* === Section cards === */
  .section-card {
    border: 1px solid var(--color-border, #1c2235);
    background: rgba(12, 15, 21, 0.6);
    transition: opacity 0.2s;
  }
  .section-card.muted {
    opacity: 0.4;
  }

  .section-header {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    border: none;
    border-bottom: 1px solid transparent;
    background: transparent;
    color: var(--color-text-primary, #f2eed8);
    padding: 0.7rem 0.85rem;
    cursor: pointer;
    user-select: none;
    transition: background 0.15s;
  }
  .section-header:hover {
    background: rgba(255, 255, 255, 0.02);
  }
  .section-header h4 {
    margin: 0;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .section-meta {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .chevron {
    display: inline-flex;
    color: var(--color-text-disabled, #4a5260);
    transition: transform 0.2s;
  }
  .chevron.rotated {
    transform: rotate(-90deg);
  }

  .count-badge {
    padding: 0.15rem 0.4rem;
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-2, #101420);
    color: var(--color-text-muted, #8a93a6);
    font-family: "JetBrains Mono", monospace;
    font-size: 0.58rem;
  }

  .toggle-pill {
    padding: 0.2rem 0.5rem;
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-1, #0c0f15);
    color: var(--color-text-muted, #8a93a6);
    font-size: 0.58rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    transition: all 0.15s;
  }
  .toggle-pill.included {
    border-color: rgba(78, 138, 98, 0.4);
    background: rgba(42, 74, 56, 0.2);
    color: var(--color-status-success-text, #80b898);
  }

  .section-body {
    padding: 0 0.85rem 0.85rem;
  }

  /* === Field grid === */
  .field-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
    gap: 0.45rem;
  }

  .field-card {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-1, #0c0f15);
    color: var(--color-text-muted, #8a93a6);
    padding: 0.55rem 0.7rem;
    text-align: left;
    transition: all 0.15s;
  }
  .field-card:hover {
    border-color: rgba(255, 255, 255, 0.08);
    background: rgba(16, 20, 32, 0.8);
  }
  .field-card.active {
    border-color: rgba(196, 154, 90, 0.5);
    background: linear-gradient(135deg, rgba(196, 154, 90, 0.08), rgba(196, 154, 90, 0.02));
    color: var(--color-text-primary, #f2eed8);
    box-shadow: 0 0 12px rgba(196, 154, 90, 0.08);
  }

  .field-check {
    display: grid;
    width: 1.25rem;
    height: 1.25rem;
    flex-shrink: 0;
    place-items: center;
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-2, #101420);
    transition: all 0.15s;
  }
  .field-card.active .field-check {
    border-color: rgba(196, 154, 90, 0.6);
    background: linear-gradient(135deg, rgba(196, 154, 90, 0.3), rgba(196, 154, 90, 0.15));
    color: var(--color-text-accent, #c49a5a);
  }

  .field-info {
    display: grid;
    gap: 0.1rem;
    min-width: 0;
  }
  .field-label {
    font-size: 0.7rem;
    font-weight: 550;
  }
  .field-value {
    overflow: hidden;
    color: var(--color-text-muted, #8a93a6);
    font-size: 0.62rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .field-card.active .field-value {
    color: var(--color-text-secondary, #c4c9d4);
  }

  /* === Tags === */
  .tag-cloud {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .tag-chip {
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-1, #0c0f15);
    color: var(--color-text-secondary, #c4c9d4);
    padding: 0.25rem 0.55rem;
    font-size: 0.65rem;
  }

  /* === Credits === */
  .credit-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
    gap: 0.4rem;
  }

  .credit-card {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 0.6rem;
    align-items: center;
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-1, #0c0f15);
    color: var(--color-text-muted, #8a93a6);
    padding: 0.5rem 0.65rem;
    text-align: left;
    transition: all 0.15s;
  }
  .credit-card:hover {
    border-color: rgba(255, 255, 255, 0.08);
  }
  .credit-card.active {
    border-color: rgba(196, 154, 90, 0.45);
    color: var(--color-text-primary, #f2eed8);
  }

  .credit-avatar {
    display: grid;
    width: 1.8rem;
    height: 1.8rem;
    place-items: center;
    border: 1px solid var(--color-border, #1c2235);
    background: linear-gradient(135deg, rgba(196, 154, 90, 0.15), rgba(255, 255, 255, 0.02));
    color: var(--color-text-muted, #8a93a6);
  }
  .credit-card.active .credit-avatar {
    border-color: rgba(196, 154, 90, 0.4);
    color: var(--color-text-accent, #c49a5a);
  }

  .credit-info {
    display: grid;
    gap: 0.05rem;
    min-width: 0;
  }
  .credit-info strong {
    overflow: hidden;
    font-size: 0.72rem;
    font-weight: 550;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .credit-info small {
    overflow: hidden;
    color: var(--color-text-muted, #8a93a6);
    font-size: 0.6rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .credit-state {
    padding: 0.15rem 0.4rem;
    border: 1px solid rgba(196, 154, 90, 0.3);
    color: var(--color-text-accent, #c49a5a);
    font-size: 0.55rem;
    font-style: normal;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .credit-state.merge {
    border-color: rgba(68, 120, 168, 0.35);
    color: var(--color-status-info-text, #70a4cc);
  }

  /* === Artwork === */
  .image-group {
    margin-bottom: 0.75rem;
  }
  .image-group:last-child { margin-bottom: 0; }

  .image-group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.4rem;
    color: var(--color-text-muted, #8a93a6);
    font-size: 0.62rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .image-count {
    color: var(--color-text-disabled, #4a5260);
    font-family: "JetBrains Mono", monospace;
    font-size: 0.55rem;
  }

  .image-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.4rem;
  }

  .image-card {
    position: relative;
    overflow: hidden;
    border: 2px solid transparent;
    background: var(--color-surface-2, #101420);
    padding: 0;
    transition: all 0.2s;
  }
  .image-card:hover {
    border-color: rgba(255, 255, 255, 0.1);
  }
  .image-card.active {
    border-color: rgba(196, 154, 90, 0.7);
    box-shadow: 0 0 0 1px rgba(196, 154, 90, 0.35), 0 0 20px rgba(196, 154, 90, 0.15);
  }

  .image-card img {
    display: block;
    width: 100%;
    object-fit: cover;
  }
  .image-group[data-aspect="poster"] .image-card img { aspect-ratio: 2 / 3; }
  .image-group[data-aspect="wide"] .image-card img { aspect-ratio: 16 / 9; }
  .image-group[data-aspect="logo"] .image-card img {
    aspect-ratio: 16 / 5;
    object-fit: contain;
    padding: 0.5rem;
  }

  .image-selected-badge {
    position: absolute;
    top: 0.3rem;
    right: 0.3rem;
    display: grid;
    width: 1.3rem;
    height: 1.3rem;
    place-items: center;
    background: rgba(196, 154, 90, 0.9);
    color: rgb(12, 15, 21);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  }

  .image-dim {
    position: absolute;
    inset: auto 0 0;
    background: linear-gradient(to top, rgba(5, 6, 9, 0.85), transparent);
    padding: 0.6rem 0.35rem 0.2rem;
    color: var(--color-text-muted, #8a93a6);
    font-family: "JetBrains Mono", monospace;
    font-size: 0.52rem;
    text-align: left;
  }

  /* === Candidates panel === */
  .candidates-panel {
    border: 1px solid var(--color-border, #1c2235);
    background: rgba(12, 15, 21, 0.6);
  }

  .candidate-list {
    display: grid;
    gap: 0.35rem;
    padding: 0 0.85rem 0.85rem;
  }

  .candidate-card {
    display: grid;
    grid-template-columns: 2.5rem minmax(0, 1fr) auto;
    gap: 0.6rem;
    align-items: center;
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-1, #0c0f15);
    color: var(--color-text-primary, #f2eed8);
    padding: 0.45rem 0.55rem;
    text-align: left;
    transition: all 0.15s;
  }
  .candidate-card:hover {
    border-color: rgba(196, 154, 90, 0.35);
    background: rgba(196, 154, 90, 0.04);
  }

  .candidate-poster {
    width: 2.5rem;
    aspect-ratio: 2 / 3;
    object-fit: cover;
    border: 1px solid var(--color-border, #1c2235);
  }
  .candidate-poster-placeholder {
    display: grid;
    width: 2.5rem;
    aspect-ratio: 2 / 3;
    place-items: center;
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-2, #101420);
    color: var(--color-text-disabled, #4a5260);
  }

  .candidate-info {
    display: grid;
    gap: 0.1rem;
    min-width: 0;
  }
  .candidate-info strong {
    overflow: hidden;
    font-size: 0.74rem;
    font-weight: 550;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .candidate-info small {
    color: var(--color-text-muted, #8a93a6);
    font-size: 0.62rem;
  }

  .candidate-arrow {
    color: var(--color-text-disabled, #4a5260);
    transition: color 0.15s;
  }
  .candidate-card:hover .candidate-arrow {
    color: var(--color-text-accent, #c49a5a);
  }

  /* === Footer === */
  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-shrink: 0;
    border-top: 1px solid var(--color-border, #1c2235);
    background: rgba(10, 12, 17, 0.97);
    padding: 0.7rem 1rem;
  }

  .footer-actions {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .btn-ghost, .btn-secondary, .btn-primary {
    display: inline-flex;
    min-height: 2.1rem;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    padding: 0 0.8rem;
    font-size: 0.72rem;
    font-weight: 500;
    transition: all 0.15s;
  }

  .btn-ghost {
    border: 1px solid transparent;
    background: transparent;
    color: var(--color-text-muted, #8a93a6);
  }
  .btn-ghost:hover {
    color: var(--color-text-primary, #f2eed8);
    background: rgba(255, 255, 255, 0.03);
  }

  .btn-secondary {
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-2, #101420);
    color: var(--color-text-secondary, #c4c9d4);
  }
  .btn-secondary:hover:not(:disabled) {
    border-color: rgba(196, 154, 90, 0.3);
    color: var(--color-text-primary, #f2eed8);
  }

  .btn-primary {
    border: 1px solid rgba(196, 154, 90, 0.6);
    background: linear-gradient(135deg, rgba(196, 154, 90, 0.22), rgba(196, 154, 90, 0.08));
    color: var(--color-text-primary, #f2eed8);
    box-shadow: 0 0 16px rgba(196, 154, 90, 0.12);
  }
  .btn-primary:hover:not(:disabled) {
    border-color: rgba(196, 154, 90, 0.8);
    box-shadow: 0 0 24px rgba(196, 154, 90, 0.2), 0 0 8px rgba(196, 154, 90, 0.15);
  }
  .btn-primary:disabled {
    border-color: var(--color-border, #1c2235);
    background: var(--color-surface-2, #101420);
    box-shadow: none;
  }

  /* === Desktop layout === */
  @media (min-width: 900px) {
    .identify-modal {
      padding: 1.5rem;
    }
    .modal-panel {
      max-width: 1200px;
      height: calc(100dvh - 3rem);
      margin: auto;
      max-height: none;
    }
    .review-layout {
      grid-template-columns: minmax(0, 1fr) 20rem;
      grid-template-rows: auto 1fr;
      align-items: start;
    }
    .hero-card {
      grid-column: 1 / -1;
    }
    .review-content {
      display: grid;
      gap: 0.85rem;
      min-width: 0;
    }
    .candidates-panel {
      position: sticky;
      top: 0;
    }
  }

  /* === Mobile layout === */
  @media (max-width: 899px) {
    .modal-panel {
      min-height: 100dvh;
      border: none;
    }
    .review-layout {
      display: grid;
      gap: 0.75rem;
    }
    .hero-visual {
      aspect-ratio: 16 / 9;
    }
    .modal-footer {
      flex-direction: column;
      align-items: stretch;
      gap: 0.5rem;
    }
    .footer-actions {
      flex-direction: column;
    }
    .btn-ghost, .btn-secondary, .btn-primary {
      width: 100%;
    }
    .image-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .field-grid {
      grid-template-columns: 1fr;
    }
    .credit-grid {
      grid-template-columns: 1fr;
    }
    .provider-cards {
      overflow-x: auto;
      flex-wrap: nowrap;
      padding-bottom: 0.25rem;
    }
    .provider-card {
      flex-shrink: 0;
    }
  }
</style>
