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
  let lightboxGroup = $state<string | null>(null);

  function toggleSection(section: string) {
    expandedSections = { ...expandedSections, [section]: !expandedSections[section] };
  }

  function openLightbox(kind: string) {
    lightboxGroup = kind;
  }

  function closeLightbox() {
    lightboxGroup = null;
  }

  const reviewableImageGroups = $derived.by(() => {
    if (!proposal) return [];
    return imageGroups(proposal.images).filter((g) => imageAspect(g.kind) !== "logo");
  });

  const lightboxImages = $derived.by(() => {
    if (!lightboxGroup || !proposal) return [];
    const group = reviewableImageGroups.find((g) => g.kind === lightboxGroup);
    return group?.images ?? [];
  });

  const lightboxSelectedUrl = $derived(lightboxGroup ? selectedImages[lightboxGroup] ?? null : null);

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
      <!-- Compact toolbar: provider + nav + close -->
      <header class="modal-toolbar">
        <div class="toolbar-left">
          {#if loadingProviders}
            <span class="toolbar-status"><Loader2 class="h-3.5 w-3.5 animate-spin" /> Loading…</span>
          {:else}
            <div class="provider-cards">
              {#each installedProviders as provider (provider.id)}
                {@const isActive = selectedProviderId === provider.id}
                {@const missingAuth = provider.missingAuthKeys.length > 0}
                <button
                  type="button"
                  class="provider-card"
                  class:active={isActive}
                  disabled={missingAuth || identifying}
                  onclick={() => void selectProvider(provider.id)}
                >
                  <Zap class="h-3.5 w-3.5" />
                  <span>{provider.name}</span>
                  {#if missingAuth}
                    <span class="prov-badge missing">Auth</span>
                  {:else if isActive && proposal}
                    <span class="prov-badge matched">Matched</span>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>
        <div class="toolbar-right">
          {#if targets.length > 1}
            <div class="nav-pill">
              <button type="button" class="nav-btn" disabled={activeIndex === 0} onclick={() => moveTo(activeIndex - 1)} aria-label="Previous">
                <ChevronLeft class="h-3.5 w-3.5" />
              </button>
              <span class="nav-count">{activeIndex + 1}/{targets.length}</span>
              <button type="button" class="nav-btn" disabled={activeIndex >= targets.length - 1} onclick={() => moveTo(activeIndex + 1)} aria-label="Next">
                <ChevronRight class="h-3.5 w-3.5" />
              </button>
            </div>
          {/if}
          <button type="button" class="close-btn" onclick={closeWorkflow} aria-label="Close">
            <X class="h-4 w-4" />
          </button>
        </div>
      </header>

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
            <AlertCircle class="h-5 w-5" />
            <span>No installed identify plugin supports this entity type.</span>
          </div>
        {:else if runnableProviders.length === 0 && !loadingProviders}
          <div class="empty-state">
            <AlertCircle class="h-5 w-5" />
            <span>Installed identify plugins need credentials before they can run.</span>
          </div>
        {:else if identifying}
          <div class="empty-state">
            <div class="scan-animation"><Loader2 class="h-5 w-5 animate-spin" /></div>
            <span>Searching with {selectedProvider?.name ?? "provider"}…</span>
          </div>
        {:else if !proposal && !loadingProviders}
          <div class="empty-state">
            <Sparkles class="h-5 w-5" />
            <span>Select a provider to search for metadata.</span>
          </div>
        {:else if proposal}
          <div class="review-sections">
            <!-- Match info bar -->
            <div class="match-bar">
              <span class="match-badge">
                <Eye class="h-3 w-3" />
                {proposal.matchReason ?? "match"}
              </span>
              <span class="match-provider">{proposal.provider}</span>
              {#if proposal.candidates.length > 1}
                <span class="match-sep">·</span>
                <span class="match-alt">{proposal.candidates.length} candidates</span>
              {/if}
            </div>

            <!-- Fields -->
            <section class="section-card">
              <div class="section-header" role="button" tabindex="0" onclick={() => toggleSection('fields')} onkeydown={(e) => e.key === 'Enter' && toggleSection('fields')}>
                <h4>Fields</h4>
                <div class="section-meta">
                  <span class="count-badge">{Object.values(selectedFields).filter(Boolean).length} / {fieldKeys.filter((f) => hasField(proposal!, f)).length}</span>
                  <span class="chevron" class:rotated={!expandedSections.fields}><ChevronDown class="h-3.5 w-3.5" /></span>
                </div>
              </div>
              {#if expandedSections.fields}
                <div class="section-body">
                  <div class="field-list">
                    {#each fieldKeys as field (field)}
                      {#if hasField(proposal, field) && field !== "tags" && field !== "credits" && field !== "images"}
                        <button
                          type="button"
                          class="field-row"
                          class:active={selectedFields[field]}
                          onclick={() => toggleField(field)}
                        >
                          <div class="field-check">
                            {#if selectedFields[field]}
                              <Check class="h-3 w-3" />
                            {/if}
                          </div>
                          <span class="field-label">{fieldLabels[field]}</span>
                          <span class="field-arrow">→</span>
                          <span class="field-new-value">{fieldValue(proposal, field)}</span>
                        </button>
                      {/if}
                    {/each}
                  </div>
                </div>
              {/if}
            </section>

            <!-- Tags -->
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

            <!-- Credits -->
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
                          <div class="credit-check">
                            {#if selectedCredits[key] !== false}
                              <Check class="h-3 w-3" />
                            {/if}
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

            <!-- Artwork — one row per kind, click to lightbox -->
            {#if reviewableImageGroups.length > 0}
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
                    <span class="chevron" class:rotated={!expandedSections.artwork}><ChevronDown class="h-3.5 w-3.5" /></span>
                  </div>
                </div>
                {#if expandedSections.artwork}
                  <div class="section-body">
                    {#each reviewableImageGroups as group (group.kind)}
                      {@const sel = selectedImages[group.kind]}
                      <div class="art-row">
                        <button type="button" class="art-row-check" class:active={!!sel} onclick={(e) => { e.stopPropagation(); if (sel) { selectedImages = { ...selectedImages, [group.kind]: null }; } else { selectedImages = { ...selectedImages, [group.kind]: group.images[0]?.url ?? null }; } }}>
                          <div class="field-check">
                            {#if sel}
                              <Check class="h-3 w-3" />
                            {/if}
                          </div>
                        </button>
                        <button type="button" class="art-row-body" onclick={() => openLightbox(group.kind)}>
                          <span class="art-kind">{group.kind}</span>
                          {#if sel}
                            <img src={sel} alt="" class="art-thumb" data-aspect={imageAspect(group.kind)} />
                          {:else}
                            <div class="art-thumb-empty" data-aspect={imageAspect(group.kind)}><ImageIcon class="h-4 w-4" /></div>
                          {/if}
                          <span class="art-detail">
                            {group.images.length} option{group.images.length === 1 ? "" : "s"}
                            {#if sel}
                              {@const img = group.images.find((i) => i.url === sel)}
                              {#if img?.width && img?.height}
                                · {img.width}×{img.height}
                              {/if}
                            {/if}
                          </span>
                          <ChevronRight class="h-3.5 w-3.5" />
                        </button>
                      </div>
                    {/each}
                  </div>
                {/if}
              </section>
            {/if}

            <!-- Candidates -->
            {#if proposal.candidates.length > 1}
              <section class="section-card">
                <div class="section-header" role="button" tabindex="0" onclick={() => toggleSection('candidates')} onkeydown={(e) => e.key === 'Enter' && toggleSection('candidates')}>
                  <h4>Other matches</h4>
                  <div class="section-meta">
                    <span class="count-badge">{proposal.candidates.length}</span>
                    <span class="chevron" class:rotated={!expandedSections.candidates}><ChevronDown class="h-3.5 w-3.5" /></span>
                  </div>
                </div>
                {#if expandedSections.candidates}
                  <div class="section-body">
                    <div class="candidate-list">
                      {#each proposal.candidates as candidate (candidate.externalIds.tmdb ?? candidate.title)}
                        <button type="button" class="candidate-card" onclick={() => rerunCandidate(candidate)}>
                          {#if candidate.posterUrl}
                            <img src={candidate.posterUrl} alt="" class="candidate-poster" />
                          {:else}
                            <div class="candidate-poster-empty"><ImageIcon class="h-4 w-4" /></div>
                          {/if}
                          <div class="candidate-info">
                            <strong>{candidate.title}</strong>
                            <small>{candidate.year ?? "Unknown year"}</small>
                          </div>
                          <ChevronRight class="h-3.5 w-3.5" />
                        </button>
                      {/each}
                    </div>
                  </div>
                {/if}
              </section>
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
              Apply
            {/if}
          </button>
        </div>
      </footer>
    </div>
  </div>
{/if}

<!-- Lightbox overlay -->
{#if lightboxGroup && proposal}
  <div class="lightbox" use:portal role="dialog" aria-modal="true" aria-label={`Select ${lightboxGroup}`}>
    <div class="lightbox-backdrop" onclick={closeLightbox} aria-hidden="true"></div>
    <div class="lightbox-panel">
      <div class="lightbox-header">
        <h3>{lightboxGroup}</h3>
        <button type="button" class="close-btn" onclick={closeLightbox} aria-label="Close"><X class="h-4 w-4" /></button>
      </div>

      <!-- Large selected image -->
      <div class="lightbox-focus">
        {#if lightboxSelectedUrl}
          <img src={lightboxSelectedUrl} alt="" data-aspect={imageAspect(lightboxGroup)} />
        {:else}
          <div class="lightbox-empty"><ImageIcon class="h-8 w-8" /><span>No image selected</span></div>
        {/if}
      </div>

      <!-- Thumbnail strip -->
      <div class="lightbox-strip">
        {#each lightboxImages as image (image.url)}
          <button
            type="button"
            class="lightbox-thumb"
            class:active={selectedImages[lightboxGroup] === image.url}
            onclick={() => { selectedImages = { ...selectedImages, [lightboxGroup!]: image.url }; }}
          >
            <img src={image.url} alt="" data-aspect={imageAspect(lightboxGroup)} />
            <span class="thumb-dim">{image.width && image.height ? `${image.width}×${image.height}` : image.source}</span>
            {#if selectedImages[lightboxGroup] === image.url}
              <div class="thumb-check"><Check class="h-3 w-3" /></div>
            {/if}
          </button>
        {/each}
      </div>
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

  /* === Toolbar === */
  .modal-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-shrink: 0;
    border-bottom: 1px solid var(--color-border, #1c2235);
    background: rgba(12, 15, 21, 0.97);
    padding: 0.55rem 0.85rem;
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
    flex: 1;
  }

  .toolbar-status {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--color-text-muted, #8a93a6);
    font-size: 0.72rem;
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-shrink: 0;
  }

  /* === Provider cards === */
  .provider-cards {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .provider-card {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-1, #0c0f15);
    color: var(--color-text-muted, #8a93a6);
    padding: 0.35rem 0.55rem;
    font-size: 0.68rem;
    transition: all 0.15s;
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
    box-shadow: 0 0 12px rgba(196, 154, 90, 0.1);
  }

  .prov-badge {
    padding: 0.1rem 0.3rem;
    font-size: 0.52rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .prov-badge.missing {
    border: 1px solid rgba(168, 72, 80, 0.4);
    color: var(--color-status-error-text, #cc7880);
  }
  .prov-badge.matched {
    border: 1px solid rgba(78, 138, 98, 0.4);
    color: var(--color-status-success-text, #80b898);
  }

  /* === Nav pill === */
  .nav-pill {
    display: flex;
    align-items: center;
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-1, #0c0f15);
  }
  .nav-btn {
    display: grid;
    width: 1.6rem;
    height: 1.6rem;
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
    padding: 0 0.3rem;
    color: var(--color-text-muted, #8a93a6);
    font-family: "JetBrains Mono", monospace;
    font-size: 0.6rem;
  }

  /* === Close button === */
  .close-btn {
    display: grid;
    width: 1.8rem;
    height: 1.8rem;
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

  /* === Body === */
  .modal-body {
    min-height: 0;
    flex: 1;
    overflow-y: auto;
    padding: 0.85rem;
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
    min-height: 14rem;
    color: var(--color-text-muted, #8a93a6);
    font-size: 0.78rem;
    text-align: center;
  }

  .scan-animation {
    display: grid;
    width: 3rem;
    height: 3rem;
    place-items: center;
    border: 1px solid rgba(196, 154, 90, 0.3);
    background: linear-gradient(135deg, rgba(196, 154, 90, 0.08), transparent);
    color: var(--color-text-accent, #c49a5a);
    box-shadow: 0 0 20px rgba(196, 154, 90, 0.12);
    animation: pulse-glow 2s ease-in-out infinite;
  }

  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 12px rgba(196, 154, 90, 0.08); }
    50% { box-shadow: 0 0 28px rgba(196, 154, 90, 0.22); }
  }

  .error-box {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 0.75rem;
    border: 1px solid rgba(168, 72, 80, 0.4);
    background: rgba(90, 44, 48, 0.15);
    color: var(--color-status-error-text, #cc7880);
    padding: 0.6rem 0.75rem;
    font-size: 0.74rem;
  }

  /* === Review sections === */
  .review-sections {
    display: grid;
    gap: 0.6rem;
  }

  /* === Match bar === */
  .match-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.65rem;
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-1, #0c0f15);
    font-size: 0.65rem;
  }

  .match-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    border: 1px solid rgba(78, 138, 98, 0.4);
    background: rgba(42, 74, 56, 0.25);
    color: var(--color-status-success-text, #80b898);
    padding: 0.15rem 0.45rem;
    font-size: 0.58rem;
    text-transform: capitalize;
  }

  .match-provider {
    color: var(--color-text-muted, #8a93a6);
    font-family: "JetBrains Mono", monospace;
    font-size: 0.6rem;
  }

  .match-sep {
    color: var(--color-text-disabled, #4a5260);
  }

  .match-alt {
    color: var(--color-text-disabled, #4a5260);
    font-family: "JetBrains Mono", monospace;
    font-size: 0.58rem;
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
    padding: 0.6rem 0.75rem;
    cursor: pointer;
    user-select: none;
    transition: background 0.15s;
  }
  .section-header:hover {
    background: rgba(255, 255, 255, 0.02);
  }
  .section-header h4 {
    margin: 0;
    font-size: 0.68rem;
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
    padding: 0.12rem 0.35rem;
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-2, #101420);
    color: var(--color-text-muted, #8a93a6);
    font-family: "JetBrains Mono", monospace;
    font-size: 0.55rem;
  }

  .toggle-pill {
    padding: 0.18rem 0.45rem;
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-1, #0c0f15);
    color: var(--color-text-muted, #8a93a6);
    font-size: 0.55rem;
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
    padding: 0 0.75rem 0.75rem;
  }

  /* === Field rows === */
  .field-list {
    display: grid;
    gap: 0.25rem;
  }

  .field-row {
    display: grid;
    grid-template-columns: auto 1fr auto minmax(0, 2fr);
    gap: 0.5rem;
    align-items: center;
    width: 100%;
    border: 1px solid transparent;
    background: transparent;
    color: var(--color-text-muted, #8a93a6);
    padding: 0.45rem 0.55rem;
    text-align: left;
    transition: all 0.15s;
  }
  .field-row:hover {
    background: rgba(255, 255, 255, 0.02);
    border-color: rgba(255, 255, 255, 0.04);
  }
  .field-row.active {
    border-color: rgba(196, 154, 90, 0.35);
    background: rgba(196, 154, 90, 0.04);
  }

  .field-check {
    display: grid;
    width: 1.15rem;
    height: 1.15rem;
    flex-shrink: 0;
    place-items: center;
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-2, #101420);
    transition: all 0.15s;
  }
  .field-row.active .field-check {
    border-color: rgba(196, 154, 90, 0.6);
    background: linear-gradient(135deg, rgba(196, 154, 90, 0.3), rgba(196, 154, 90, 0.15));
    color: var(--color-text-accent, #c49a5a);
  }

  .field-label {
    font-size: 0.68rem;
    font-weight: 500;
    color: var(--color-text-secondary, #c4c9d4);
  }

  .field-arrow {
    color: var(--color-text-disabled, #4a5260);
    font-size: 0.72rem;
    font-weight: 600;
  }
  .field-row.active .field-arrow {
    color: var(--color-text-accent, #c49a5a);
  }

  .field-new-value {
    overflow: hidden;
    color: var(--color-text-muted, #8a93a6);
    font-size: 0.68rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .field-row.active .field-new-value {
    color: var(--color-text-primary, #f2eed8);
  }

  /* === Tags === */
  .tag-cloud {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .tag-chip {
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-1, #0c0f15);
    color: var(--color-text-secondary, #c4c9d4);
    padding: 0.2rem 0.5rem;
    font-size: 0.62rem;
  }

  /* === Credits === */
  .credit-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
    gap: 0.35rem;
  }

  .credit-card {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 0.5rem;
    align-items: center;
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-1, #0c0f15);
    color: var(--color-text-muted, #8a93a6);
    padding: 0.45rem 0.6rem;
    text-align: left;
    transition: all 0.15s;
  }
  .credit-card:hover {
    border-color: rgba(255, 255, 255, 0.06);
  }
  .credit-card.active {
    border-color: rgba(196, 154, 90, 0.4);
    color: var(--color-text-primary, #f2eed8);
  }

  .credit-check {
    display: grid;
    width: 1.15rem;
    height: 1.15rem;
    flex-shrink: 0;
    place-items: center;
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-2, #101420);
    transition: all 0.15s;
  }
  .credit-card.active .credit-check {
    border-color: rgba(196, 154, 90, 0.6);
    background: linear-gradient(135deg, rgba(196, 154, 90, 0.3), rgba(196, 154, 90, 0.15));
    color: var(--color-text-accent, #c49a5a);
  }

  .credit-info {
    display: grid;
    gap: 0.05rem;
    min-width: 0;
  }
  .credit-info strong {
    overflow: hidden;
    font-size: 0.7rem;
    font-weight: 550;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .credit-info small {
    overflow: hidden;
    color: var(--color-text-muted, #8a93a6);
    font-size: 0.58rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .credit-state {
    padding: 0.12rem 0.35rem;
    border: 1px solid rgba(196, 154, 90, 0.3);
    color: var(--color-text-accent, #c49a5a);
    font-size: 0.52rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .credit-state.merge {
    border-color: rgba(68, 120, 168, 0.35);
    color: var(--color-status-info-text, #70a4cc);
  }

  /* === Artwork rows === */
  .art-row {
    display: flex;
    align-items: center;
    gap: 0;
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-1, #0c0f15);
    margin-bottom: 0.3rem;
  }
  .art-row:last-child { margin-bottom: 0; }

  .art-row-check {
    display: grid;
    width: 2.5rem;
    place-items: center;
    align-self: stretch;
    border: none;
    border-right: 1px solid var(--color-border, #1c2235);
    background: transparent;
    color: var(--color-text-disabled, #4a5260);
    transition: all 0.15s;
  }
  .art-row-check:hover {
    background: rgba(255, 255, 255, 0.02);
  }
  .art-row-check.active {
    color: var(--color-text-accent, #c49a5a);
    background: rgba(196, 154, 90, 0.04);
  }

  .art-row-body {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    color: var(--color-text-secondary, #c4c9d4);
    padding: 0.45rem 0.65rem;
    text-align: left;
    transition: background 0.15s;
  }
  .art-row-body:hover {
    background: rgba(255, 255, 255, 0.02);
  }

  .art-kind {
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-text-muted, #8a93a6);
    min-width: 4.5rem;
  }

  .art-thumb {
    width: 2.5rem;
    height: auto;
    border: 1px solid var(--color-border, #1c2235);
    object-fit: cover;
    flex-shrink: 0;
  }
  .art-thumb[data-aspect="poster"] { aspect-ratio: 2 / 3; }
  .art-thumb[data-aspect="wide"] { aspect-ratio: 16 / 9; }

  .art-thumb-empty {
    display: grid;
    width: 2.5rem;
    place-items: center;
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-2, #101420);
    color: var(--color-text-disabled, #4a5260);
    flex-shrink: 0;
  }
  .art-thumb-empty[data-aspect="poster"] { aspect-ratio: 2 / 3; }
  .art-thumb-empty[data-aspect="wide"] { aspect-ratio: 16 / 9; }

  .art-detail {
    flex: 1;
    min-width: 0;
    color: var(--color-text-disabled, #4a5260);
    font-family: "JetBrains Mono", monospace;
    font-size: 0.58rem;
  }

  /* === Candidates === */
  .candidate-list {
    display: grid;
    gap: 0.3rem;
  }

  .candidate-card {
    display: grid;
    grid-template-columns: 2.2rem minmax(0, 1fr) auto;
    gap: 0.5rem;
    align-items: center;
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-1, #0c0f15);
    color: var(--color-text-primary, #f2eed8);
    padding: 0.4rem 0.5rem;
    text-align: left;
    transition: all 0.15s;
  }
  .candidate-card:hover {
    border-color: rgba(196, 154, 90, 0.3);
    background: rgba(196, 154, 90, 0.04);
  }

  .candidate-poster {
    width: 2.2rem;
    aspect-ratio: 2 / 3;
    object-fit: cover;
    border: 1px solid var(--color-border, #1c2235);
  }
  .candidate-poster-empty {
    display: grid;
    width: 2.2rem;
    aspect-ratio: 2 / 3;
    place-items: center;
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-2, #101420);
    color: var(--color-text-disabled, #4a5260);
  }

  .candidate-info {
    display: grid;
    gap: 0.08rem;
    min-width: 0;
  }
  .candidate-info strong {
    overflow: hidden;
    font-size: 0.72rem;
    font-weight: 550;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .candidate-info small {
    color: var(--color-text-muted, #8a93a6);
    font-size: 0.6rem;
  }

  /* === Footer === */
  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-shrink: 0;
    border-top: 1px solid var(--color-border, #1c2235);
    background: rgba(10, 12, 17, 0.97);
    padding: 0.6rem 0.85rem;
  }

  .footer-actions {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .btn-ghost, .btn-secondary, .btn-primary {
    display: inline-flex;
    min-height: 2rem;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    padding: 0 0.7rem;
    font-size: 0.7rem;
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

  /* === Lightbox overlay === */
  .lightbox {
    position: fixed;
    inset: 0;
    z-index: 1600;
    display: flex;
    align-items: center;
    justify-content: center;
    isolation: isolate;
    animation: modal-in 0.2s ease-out;
  }

  .lightbox-backdrop {
    position: absolute;
    inset: 0;
    z-index: 0;
    background: rgba(2, 3, 5, 0.94);
    backdrop-filter: blur(6px);
  }

  .lightbox-panel {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 56rem;
    max-height: 90dvh;
    border: 1px solid var(--color-border, #1c2235);
    background: linear-gradient(180deg, rgb(12, 15, 21) 0%, rgb(8, 10, 15) 100%);
    box-shadow: 0 32px 80px rgba(0, 0, 0, 0.7);
    animation: panel-in 0.25s ease-out;
  }

  .lightbox-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.6rem 0.85rem;
    border-bottom: 1px solid var(--color-border, #1c2235);
  }
  .lightbox-header h3 {
    margin: 0;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-text-primary, #f2eed8);
  }

  .lightbox-focus {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
    padding: 1.5rem;
    overflow: hidden;
  }
  .lightbox-focus img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border: 1px solid var(--color-border, #1c2235);
    box-shadow: 0 0 0 1px rgba(196, 154, 90, 0.3), 0 0 20px rgba(196, 154, 90, 0.1);
  }

  .lightbox-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    color: var(--color-text-disabled, #4a5260);
    font-size: 0.75rem;
  }

  .lightbox-strip {
    display: flex;
    gap: 0.4rem;
    padding: 0.75rem 0.85rem;
    border-top: 1px solid var(--color-border, #1c2235);
    overflow-x: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(196, 154, 90, 0.2) transparent;
  }

  .lightbox-thumb {
    position: relative;
    flex-shrink: 0;
    width: 4.5rem;
    border: 2px solid transparent;
    background: var(--color-surface-2, #101420);
    padding: 0;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .lightbox-thumb:hover {
    border-color: rgba(255, 255, 255, 0.12);
  }
  .lightbox-thumb.active {
    border-color: rgba(196, 154, 90, 0.7);
    box-shadow: 0 0 0 1px rgba(196, 154, 90, 0.35), 0 0 12px rgba(196, 154, 90, 0.15);
  }
  .lightbox-thumb img {
    display: block;
    width: 100%;
    object-fit: cover;
  }
  .lightbox-thumb img[data-aspect="poster"] { aspect-ratio: 2 / 3; }
  .lightbox-thumb img[data-aspect="wide"] { aspect-ratio: 16 / 9; }

  .thumb-dim {
    position: absolute;
    inset: auto 0 0;
    background: rgba(5, 6, 9, 0.8);
    padding: 0.15rem 0.25rem;
    color: var(--color-text-muted, #8a93a6);
    font-family: "JetBrains Mono", monospace;
    font-size: 0.48rem;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .thumb-check {
    position: absolute;
    top: 0.2rem;
    right: 0.2rem;
    display: grid;
    width: 1rem;
    height: 1rem;
    place-items: center;
    background: rgba(196, 154, 90, 0.9);
    color: rgb(12, 15, 21);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
  }

  /* === Desktop layout === */
  @media (min-width: 900px) {
    .identify-modal {
      padding: 1.5rem;
    }
    .modal-panel {
      max-width: 52rem;
      height: calc(100dvh - 3rem);
      margin: auto;
      max-height: none;
    }
    .lightbox-panel {
      margin: 1rem;
    }
  }

  /* === Mobile layout === */
  @media (max-width: 899px) {
    .modal-panel {
      min-height: 100dvh;
      border: none;
    }
    .modal-toolbar {
      flex-wrap: wrap;
    }
    .provider-cards {
      overflow-x: auto;
      flex-wrap: nowrap;
      padding-bottom: 0.2rem;
    }
    .provider-card {
      flex-shrink: 0;
    }
    .modal-footer {
      flex-direction: column;
      align-items: stretch;
      gap: 0.4rem;
    }
    .footer-actions {
      flex-direction: column;
    }
    .btn-ghost, .btn-secondary, .btn-primary {
      width: 100%;
    }
    .field-row {
      grid-template-columns: auto 1fr auto minmax(0, 1.5fr);
    }
    .credit-grid {
      grid-template-columns: 1fr;
    }
    .lightbox-panel {
      max-height: 100dvh;
      border: none;
    }
    .lightbox-focus {
      padding: 0.75rem;
    }
    .lightbox-thumb {
      width: 3.5rem;
    }
  }
</style>
