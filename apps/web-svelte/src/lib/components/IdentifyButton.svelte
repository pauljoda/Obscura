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
    fetchEntityTagTitles,
    fetchIdentifyProviders,
    identifyEntity,
    type CreditPatch,
    type EntityMetadataProposal,
    type EntitySearchCandidate,
    type ImageCandidate,
    type PluginProvider,
  } from "$lib/api/identify";
  import EntityThumbnail from "$lib/components/thumbnails/EntityThumbnail.svelte";
  import type { EntityThumbnailCard } from "$lib/entities/entity-thumbnail";

  type LegacyEntityKind = "video_series" | "video_movie" | "video_episode" | "book";

  interface IdentifyTarget {
    entityKind: LegacyEntityKind | string;
    entityId: string;
    title: string;
    existingCreditNames?: string[];
    existingTags?: string[];
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
  let selectedTags = $state<Record<string, boolean>>({});
  let fetchedExistingTags = $state<string[]>([]);
  let applying = $state(false);
  let error = $state<string | null>(null);
  let expandedSections = $state<Record<string, boolean>>({ fields: true, tags: true, credits: true, studio: true, artwork: true, candidates: true });
  let lightboxGroup = $state<string | null>(null);

  const scalarFieldKeys = ["title", "description", "externalIds", "urls", "dates", "counters", "stats", "positions", "classification"];

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
    selectedTags = {};
    fetchedExistingTags = [];
    error = null;
    if (!providersLoaded) await loadProviders();
    fetchEntityTagTitles(entityId).then((tags) => { fetchedExistingTags = tags; }).catch(() => {});
  }

  function closeWorkflow() {
    workflowOpen = false;
    proposal = null;
    selectedProviderId = "";
    selectedFields = {};
    selectedImages = {};
    selectedCredits = {};
    selectedTags = {};
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
      selectedTags = Object.fromEntries(nextProposal.patch.tags.map((tag) => [tag, true]));
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

  function toggleTag(tag: string) {
    selectedTags = { ...selectedTags, [tag]: !selectedTags[tag] };
  }

  function isNewTag(tag: string): boolean {
    const existing = fetchedExistingTags.length > 0 ? fetchedExistingTags : (activeTarget?.existingTags ?? []);
    return !existing.some((t) => t.localeCompare(tag, undefined, { sensitivity: "accent" }) === 0);
  }

  const selectedTagCount = $derived(Object.values(selectedTags).filter(Boolean).length);

  function findChildImage(children: EntityMetadataProposal[], targetKind: string, name: string): string | null {
    const child = children.find(
      (c) => c.targetKind === targetKind && (c.patch.title ?? "").localeCompare(name, undefined, { sensitivity: "accent" }) === 0,
    );
    if (!child?.images.length) return null;
    const poster = child.images.find((img) => img.kind === "poster") ?? child.images[0];
    return poster?.url ?? null;
  }

  function creditToCard(credit: CreditPatch, children: EntityMetadataProposal[]): EntityThumbnailCard {
    const imageUrl = findChildImage(children, "person", credit.name);
    return {
      entity: { id: `proposal-${credit.name}`, kind: "person", title: credit.name, capabilities: [] },
      aspectRatio: { width: 4, height: 5 },
      cover: imageUrl ? { src: imageUrl, alt: credit.name } : null,
      hover: { kind: "none" },
      subtitle: credit.character ? `${credit.role} · ${credit.character}` : credit.role,
    };
  }

  const creditCards = $derived.by((): EntityThumbnailCard[] => {
    if (!proposal) return [];
    return proposal.patch.credits.map((c) => creditToCard(c, proposal!.children));
  });

  const studioCard = $derived.by((): EntityThumbnailCard | null => {
    if (!proposal?.patch.studio) return null;
    const imageUrl = findChildImage(proposal.children, "studio", proposal.patch.studio);
    return {
      entity: { id: `proposal-studio`, kind: "studio", title: proposal.patch.studio, capabilities: [] },
      aspectRatio: "wide",
      cover: imageUrl ? { src: imageUrl, alt: proposal.patch.studio } : null,
      hover: { kind: "none" },
    };
  });

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
    selectedTags = {};
    selectedImages = {};
    selectedCredits = {};
    error = null;
    if (selectedProvider) void run(selectedProvider);
  }

  function proposalForApply(result: EntityMetadataProposal): EntityMetadataProposal {
    const credits = result.patch.credits.filter((credit, index) =>
      selectedCredits[creditKey(credit, index)] !== false,
    );
    const tags = result.patch.tags.filter((tag) => selectedTags[tag] !== false);
    return {
      ...result,
      patch: {
        ...result.patch,
        credits,
        tags,
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

            <!-- Scalar Fields -->
            <section class="section-card">
              <div class="section-header" role="button" tabindex="0" onclick={() => toggleSection('fields')} onkeydown={(e) => e.key === 'Enter' && toggleSection('fields')}>
                <h4>Fields</h4>
                <div class="section-meta">
                  <span class="count-badge">{scalarFieldKeys.filter((f) => selectedFields[f]).length} / {scalarFieldKeys.filter((f) => hasField(proposal!, f)).length}</span>
                  <span class="chevron" class:rotated={!expandedSections.fields}><ChevronDown class="h-3.5 w-3.5" /></span>
                </div>
              </div>
              {#if expandedSections.fields}
                <div class="section-body">
                  <div class="field-list">
                    {#each scalarFieldKeys as field (field)}
                      {#if hasField(proposal, field)}
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
                          <span class="field-new-value" class:field-wrap={field === "description"}>{fieldValue(proposal, field)}</span>
                        </button>
                      {/if}
                    {/each}
                  </div>
                </div>
              {/if}
            </section>

            <!-- Tags — individually selectable -->
            {#if proposal.patch.tags.length > 0}
              <section class="section-card">
                <div class="section-header" role="button" tabindex="0" onclick={() => toggleSection('tags')} onkeydown={(e) => e.key === 'Enter' && toggleSection('tags')}>
                  <h4>Tags</h4>
                  <div class="section-meta">
                    <span class="count-badge">{selectedTagCount} / {proposal.patch.tags.length}</span>
                    <span class="chevron" class:rotated={!expandedSections.tags}><ChevronDown class="h-3.5 w-3.5" /></span>
                  </div>
                </div>
                {#if expandedSections.tags}
                  <div class="section-body">
                    <div class="tag-cloud">
                      {#each proposal.patch.tags as tag (tag)}
                        <button
                          type="button"
                          class="tag-select"
                          class:active={selectedTags[tag]}
                          class:is-new={isNewTag(tag)}
                          onclick={() => toggleTag(tag)}
                        >
                          <span class="tag-check">
                            {#if selectedTags[tag]}
                              <Check class="h-2.5 w-2.5" />
                            {/if}
                          </span>
                          <span>{tag}</span>
                          {#if isNewTag(tag)}
                            <span class="tag-new-label">NEW</span>
                          {/if}
                        </button>
                      {/each}
                    </div>
                  </div>
                {/if}
              </section>
            {/if}

            <!-- Studio -->
            {#if proposal.patch.studio && studioCard}
              <section class="section-card" class:muted={!selectedFields.studio}>
                <div class="section-header" role="button" tabindex="0" onclick={() => toggleSection('studio')} onkeydown={(e) => e.key === 'Enter' && toggleSection('studio')}>
                  <h4>Studio</h4>
                  <div class="section-meta">
                    <button
                      type="button"
                      class="toggle-pill"
                      class:included={selectedFields.studio}
                      onclick={(e) => { e.stopPropagation(); toggleField("studio"); }}
                    >
                      {selectedFields.studio ? "Included" : "Excluded"}
                    </button>
                    <span class="chevron" class:rotated={!expandedSections.studio}><ChevronDown class="h-3.5 w-3.5" /></span>
                  </div>
                </div>
                {#if expandedSections.studio}
                  <div class="section-body">
                    <div class="studio-row">
                      <EntityThumbnail card={studioCard} titleAlign="center" titleSize="compact" />
                    </div>
                  </div>
                {/if}
              </section>
            {/if}

            <!-- Credits -->
            {#if proposal.patch.credits.length > 0}
              <section class="section-card" class:muted={!selectedFields.credits}>
                <div class="section-header" role="button" tabindex="0" onclick={() => toggleSection('credits')} onkeydown={(e) => e.key === 'Enter' && toggleSection('credits')}>
                  <h4>Cast & Crew</h4>
                  <div class="section-meta">
                    <button
                      type="button"
                      class="toggle-pill"
                      class:included={selectedFields.credits}
                      onclick={(e) => { e.stopPropagation(); toggleField("credits"); }}
                    >
                      {selectedFields.credits ? "Included" : "Excluded"}
                    </button>
                    <span class="count-badge">{Object.values(selectedCredits).filter(Boolean).length} / {proposal.patch.credits.length}</span>
                    <span class="chevron" class:rotated={!expandedSections.credits}><ChevronDown class="h-3.5 w-3.5" /></span>
                  </div>
                </div>
                {#if expandedSections.credits}
                  <div class="section-body">
                    <div class="credit-scroller">
                      {#each proposal.patch.credits as credit, index (creditKey(credit, index))}
                        {@const key = creditKey(credit, index)}
                        {@const state = creditState(credit)}
                        <div class="credit-thumbnail">
                          <EntityThumbnail
                            card={creditCards[index]}
                            titleAlign="center"
                            titleSize="compact"
                            selectable
                            selected={selectedCredits[key] !== false}
                            onSelectedChange={() => toggleCredit(key)}
                          >
                            {#snippet subtitleContent()}
                              <span class="credit-role-label">{credit.character ? `${credit.role} · ${credit.character}` : credit.role}</span>
                              {#if state === "new"}
                                <span class="credit-new-label">NEW</span>
                              {/if}
                            {/snippet}
                          </EntityThumbnail>
                        </div>
                      {/each}
                    </div>
                  </div>
                {/if}
              </section>
            {/if}

            <!-- Artwork -->
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
                    <div class="art-grid">
                      {#each reviewableImageGroups as group (group.kind)}
                        {@const sel = selectedImages[group.kind]}
                        <div class="art-card" class:active={!!sel}>
                          <div class="art-card-header">
                            <button type="button" class="art-card-check" class:active={!!sel} onclick={() => { if (sel) { selectedImages = { ...selectedImages, [group.kind]: null }; } else { selectedImages = { ...selectedImages, [group.kind]: group.images[0]?.url ?? null }; } }}>
                              <div class="field-check">
                                {#if sel}
                                  <Check class="h-3 w-3" />
                                {/if}
                              </div>
                            </button>
                            <span class="art-kind">{group.kind}</span>
                            <span class="art-count">{group.images.length} option{group.images.length === 1 ? "" : "s"}</span>
                          </div>
                          <button type="button" class="art-card-preview" onclick={() => openLightbox(group.kind)}>
                            {#if sel}
                              <img src={sel} alt="{group.kind} preview" class="art-preview-img" data-aspect={imageAspect(group.kind)} />
                            {:else}
                              <div class="art-preview-empty" data-aspect={imageAspect(group.kind)}>
                                <ImageIcon class="h-6 w-6" />
                                <span>Select image</span>
                              </div>
                            {/if}
                            <div class="art-browse-hint">
                              <span>Browse</span>
                              <ChevronRight class="h-3.5 w-3.5" />
                            </div>
                          </button>
                        </div>
                      {/each}
                    </div>
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

<!-- Lightbox overlay — slides in from right, same size as main modal -->
{#if lightboxGroup && proposal}
  <div class="lightbox" use:portal role="dialog" aria-modal="true" aria-label={`Select ${lightboxGroup}`}>
    <div class="lightbox-backdrop" onclick={closeLightbox} aria-hidden="true"></div>
    <div class="lightbox-panel">
      <header class="lightbox-header">
        <h3>{lightboxGroup}</h3>
        <button type="button" class="btn-primary" onclick={closeLightbox}>
          <Check class="h-3.5 w-3.5" />
          Confirm
        </button>
      </header>

      <div class="lightbox-focus">
        {#if lightboxSelectedUrl}
          <img src={lightboxSelectedUrl} alt="{lightboxGroup} preview" />
        {:else}
          <div class="lightbox-empty"><ImageIcon class="h-8 w-8" /><span>No image selected</span></div>
        {/if}
      </div>

      <div class="lightbox-strip">
        {#each lightboxImages as image (image.url)}
          <button
            type="button"
            class="lightbox-thumb"
            class:active={selectedImages[lightboxGroup] === image.url}
            onclick={() => { selectedImages = { ...selectedImages, [lightboxGroup!]: image.url }; }}
          >
            <img src={image.url} alt="" data-aspect={imageAspect(lightboxGroup)} />
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
  .field-new-value.field-wrap {
    white-space: normal;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    line-height: 1.45;
  }
  .field-row.active .field-new-value {
    color: var(--color-text-primary, #f2eed8);
  }

  /* === Tags — individually selectable chips === */
  .tag-cloud {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }

  .tag-select {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-1, #0c0f15);
    color: var(--color-text-muted, #8a93a6);
    padding: 0.25rem 0.5rem;
    font-size: 0.62rem;
    font-weight: 500;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    transition: all 0.15s;
  }
  .tag-select:hover {
    border-color: rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.03);
  }
  .tag-select.active {
    border-color: rgba(196, 154, 90, 0.45);
    background: rgba(196, 154, 90, 0.08);
    color: var(--color-text-primary, #f2eed8);
  }
  .tag-select.is-new.active {
    border-color: rgba(78, 138, 98, 0.5);
    background: rgba(42, 74, 56, 0.15);
  }

  .tag-check {
    display: grid;
    width: 0.9rem;
    height: 0.9rem;
    place-items: center;
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-2, #101420);
    transition: all 0.15s;
  }
  .tag-select.active .tag-check {
    border-color: rgba(196, 154, 90, 0.6);
    background: linear-gradient(135deg, rgba(196, 154, 90, 0.3), rgba(196, 154, 90, 0.15));
    color: var(--color-text-accent, #c49a5a);
  }
  .tag-select.is-new.active .tag-check {
    border-color: rgba(78, 138, 98, 0.5);
    background: linear-gradient(135deg, rgba(78, 138, 98, 0.3), rgba(78, 138, 98, 0.15));
    color: var(--color-status-success-text, #80b898);
  }

  .tag-new-label {
    padding: 0.05rem 0.25rem;
    border: 1px solid rgba(78, 138, 98, 0.4);
    color: var(--color-status-success-text, #80b898);
    font-size: 0.48rem;
    letter-spacing: 0.06em;
  }

  /* === Studio === */
  .studio-row {
    display: flex;
    gap: 0.75rem;
  }
  .studio-row :global(.entity-thumbnail) {
    flex: 0 0 clamp(8rem, 30vw, 12rem);
  }

  /* === Credits — horizontal EntityThumbnail scroller === */
  .credit-scroller {
    display: flex;
    gap: 0.6rem;
    overflow-x: auto;
    overflow-y: hidden;
    scroll-padding-inline: 0.25rem;
    scrollbar-width: thin;
    scrollbar-color: rgba(196, 154, 90, 0.15) transparent;
    padding-bottom: 0.25rem;
  }

  .credit-thumbnail {
    flex: 0 0 clamp(6.5rem, 28vw, 8.5rem);
  }

  .credit-role-label {
    display: block;
    overflow: hidden;
    padding: 0.1rem 0.3rem;
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-1, #0c0f15);
    color: var(--color-text-muted, #8a93a6);
    font-family: "JetBrains Mono", monospace;
    font-size: 0.52rem;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .credit-new-label {
    display: block;
    margin-top: 0.15rem;
    padding: 0.05rem 0.25rem;
    border: 1px solid rgba(78, 138, 98, 0.4);
    color: var(--color-status-success-text, #80b898);
    font-size: 0.48rem;
    font-family: "JetBrains Mono", monospace;
    text-align: center;
    letter-spacing: 0.06em;
  }

  /* === Artwork cards === */
  .art-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
    gap: 0.5rem;
  }

  .art-card {
    border: 1px solid var(--color-border, #1c2235);
    background: var(--color-surface-1, #0c0f15);
    transition: border-color 0.15s;
  }
  .art-card.active {
    border-color: rgba(196, 154, 90, 0.35);
  }

  .art-card-header {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.55rem;
    border-bottom: 1px solid var(--color-border, #1c2235);
  }

  .art-card-check {
    border: none;
    background: transparent;
    padding: 0;
    color: var(--color-text-disabled, #4a5260);
    transition: color 0.15s;
  }
  .art-card-check.active {
    color: var(--color-text-accent, #c49a5a);
  }

  .art-kind {
    font-size: 0.6rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-text-muted, #8a93a6);
  }

  .art-count {
    margin-left: auto;
    color: var(--color-text-disabled, #4a5260);
    font-family: "JetBrains Mono", monospace;
    font-size: 0.52rem;
  }

  .art-card-preview {
    position: relative;
    display: block;
    width: 100%;
    border: none;
    background: transparent;
    padding: 0;
    text-align: left;
    transition: opacity 0.15s;
  }
  .art-card-preview:hover {
    opacity: 0.85;
  }

  .art-preview-img {
    display: block;
    width: 100%;
    object-fit: cover;
  }
  .art-preview-img[data-aspect="poster"] { aspect-ratio: 2 / 3; }
  .art-preview-img[data-aspect="wide"] { aspect-ratio: 16 / 9; }

  .art-preview-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.3rem;
    width: 100%;
    background: var(--color-surface-2, #101420);
    color: var(--color-text-disabled, #4a5260);
    font-size: 0.6rem;
  }
  .art-preview-empty[data-aspect="poster"] { aspect-ratio: 2 / 3; }
  .art-preview-empty[data-aspect="wide"] { aspect-ratio: 16 / 9; }

  .art-browse-hint {
    position: absolute;
    right: 0.4rem;
    bottom: 0.4rem;
    display: flex;
    align-items: center;
    gap: 0.2rem;
    padding: 0.2rem 0.4rem;
    background: rgba(5, 6, 9, 0.8);
    backdrop-filter: blur(4px);
    color: var(--color-text-secondary, #c4c9d4);
    font-size: 0.55rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.04em;
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

  /* === Lightbox — same size as main modal, slide-in from right === */
  .lightbox {
    position: fixed;
    inset: 0;
    z-index: 1600;
    display: flex;
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

  @keyframes slide-in-right {
    from { transform: translateX(100%); opacity: 0.6; }
    to { transform: translateX(0); opacity: 1; }
  }

  .lightbox-panel {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100dvh;
    max-height: 100dvh;
    border: 1px solid var(--color-border, #1c2235);
    background: linear-gradient(180deg, rgb(12, 15, 21) 0%, rgb(8, 10, 15) 100%);
    box-shadow: 0 32px 80px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.03);
    animation: slide-in-right 0.28s cubic-bezier(0.25, 0, 0.25, 1);
  }

  .lightbox-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    padding: 0.55rem 0.85rem;
    border-bottom: 1px solid var(--color-border, #1c2235);
    background: rgba(12, 15, 21, 0.97);
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
    padding: 1rem;
    overflow: hidden;
  }
  .lightbox-focus img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
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
    flex-shrink: 0;
    padding: 0.65rem 0.85rem;
    border-top: 1px solid var(--color-border, #1c2235);
    background: rgba(10, 12, 17, 0.6);
    overflow-x: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(196, 154, 90, 0.15) transparent;
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
      max-width: 52rem;
      height: calc(100dvh - 3rem);
      margin: auto;
      max-height: none;
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
    .art-grid {
      grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
    }
    .lightbox-panel {
      min-height: 100dvh;
      border: none;
    }
    .lightbox-focus {
      padding: 0.5rem;
    }
    .lightbox-thumb {
      width: 3.5rem;
    }
  }
</style>
