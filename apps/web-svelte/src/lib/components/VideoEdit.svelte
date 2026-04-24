<script lang="ts">
  import { onMount } from "svelte";
  import {
    AlertTriangle,
    Loader2,
    Pencil,
    Star,
    Calendar,
    Link2,
    User,
    Tag as TagIcon,
    Image as ImageIcon,
    Upload,
    Building2,
    FileText,
    Droplets,
    Heart,
    CheckCircle2,
    Clapperboard,
    Tv,
    X,
  } from "@lucide/svelte";
  import { Button, cn } from "@obscura/ui-svelte";
  import type { VideoDetailDto } from "@obscura/contracts";
  import type { TagItem, PerformerItem, StudioItem } from "$lib/api/types";
  import {
    fetchVideoDetail,
    updateVideo,
    uploadVideoThumbnail,
    deleteVideoThumbnail,
    generateVideoThumbnailFromFrame,
  } from "$lib/api/videos";
  import { fetchTags, fetchPerformers, fetchStudios } from "$lib/api/entities";
  import { useNsfw } from "$lib/nsfw/store.svelte";
  import { toApiUrl } from "$lib/api/core";
  import { entityTerms } from "$lib/terminology";
  import NsfwTagLabel from "./nsfw/NsfwTagLabel.svelte";
  import {
    DateField,
    EditFormShell,
    SearchSelect,
    TagSelect,
    TextAreaField,
    TextField,
    ToggleChip,
    type SearchOption,
    type TagOption,
  } from "$lib/components/forms";

  interface Props {
    id: string;
    inline?: boolean;
    onSaved?: () => void;
    currentPlaybackTime?: number;
  }

  let { id, inline = false, onSaved, currentPlaybackTime }: Props = $props();

  const nsfw = useNsfw();
  const terms = entityTerms;
  const explicitCounterLabels = $derived(nsfw.mode === "show");

  let video = $state<VideoDetailDto | null>(null);
  let loading = $state(true);
  let saving = $state(false);
  let error = $state<string | null>(null);
  let message = $state<string | null>(null);
  let editing = $state(false);

  let title = $state("");
  let details = $state("");
  let date = $state("");
  let url = $state("");
  let isNsfw = $state(false);
  let studioName = $state("");
  let performerNames = $state<string[]>([]);
  let tagNames = $state<string[]>([]);
  let orgasmCountStr = $state("0");
  let seasonNumber = $state("");
  let episodeNumber = $state("");
  let absoluteEpisodeNumber = $state("");

  let allTags = $state<TagItem[]>([]);
  let allPerformers = $state<PerformerItem[]>([]);
  let allStudios = $state<StudioItem[]>([]);

  const studioSuggestions = $derived<SearchOption[]>(
    allStudios.map((s) => ({ id: s.id, name: s.name })),
  );
  const performerSuggestions = $derived<TagOption[]>(
    allPerformers.map((p) => ({ name: p.name, count: p.videoCount })),
  );
  const tagSuggestions = $derived<TagOption[]>(
    allTags.map((t) => ({
      name: t.name,
      count: (t.videoCount ?? 0) + ((t.imageCount ?? 0) as number),
    })),
  );

  let thumbnailInput: HTMLInputElement | null = $state(null);
  let uploadingThumb = $state(false);
  let generatingFrameThumb = $state(false);

  const hasCustomThumbnail = $derived(video?.thumbnailPath?.includes("thumb-custom") ?? false);
  const hasPlaybackFrameTime = $derived(
    typeof currentPlaybackTime === "number" && Number.isFinite(currentPlaybackTime),
  );
  const playbackFrameTime = $derived(hasPlaybackFrameTime ? currentPlaybackTime! : null);

  function formatSecondsLabel(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function populateForm(v: VideoDetailDto) {
    title = v.title;
    details = v.details ?? "";
    date = v.date ?? "";
    url = v.url ?? "";
    isNsfw = v.isNsfw ?? false;
    studioName = v.studio?.name ?? "";
    performerNames = v.performers.map((p) => p.name);
    tagNames = v.tags.map((t) => t.name);
    orgasmCountStr = String(v.orgasmCount ?? 0);
    seasonNumber = v.seasonNumber != null ? String(v.seasonNumber) : "";
    episodeNumber = v.episodeNumber != null ? String(v.episodeNumber) : "";
    absoluteEpisodeNumber =
      (v as { absoluteEpisodeNumber?: number | null }).absoluteEpisodeNumber != null
        ? String((v as { absoluteEpisodeNumber?: number | null }).absoluteEpisodeNumber)
        : "";
  }

  async function reload() {
    loading = true;
    try {
      const [v, tagsData, performersData, studiosData] = await Promise.all([
        fetchVideoDetail(id),
        fetchTags({ nsfw: nsfw.mode }).catch(() => ({ tags: [] as TagItem[] })),
        fetchPerformers({ nsfw: nsfw.mode, limit: 100 }).catch(() => ({ performers: [] as PerformerItem[], total: 0, limit: 100, offset: 0 })),
        fetchStudios({ nsfw: nsfw.mode }).catch(() => ({ studios: [] as StudioItem[] })),
      ]);
      video = v;
      populateForm(v);
      allTags = tagsData.tags;
      allPerformers = performersData.performers;
      allStudios = studiosData.studios;
      error = null;
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load";
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void reload();
  });

  function enterEditMode() {
    if (video) populateForm(video);
    error = null;
    message = null;
    editing = true;
  }

  function cancelEdit() {
    if (video) populateForm(video);
    error = null;
    message = null;
    editing = false;
  }

  async function handleSave() {
    saving = true;
    error = null;
    message = null;
    try {
      const parseNullable = (raw: string): number | null | undefined => {
        if (raw.trim() === "") return null;
        const n = Number.parseInt(raw, 10);
        return Number.isFinite(n) && n >= 0 ? n : undefined;
      };
      const orgasmCountNum = Number.parseInt(orgasmCountStr, 10);
      const patch: Parameters<typeof updateVideo>[1] = {
        title: title.trim(),
        details: details.trim() || null,
        date: date.trim() || null,
        url: url.trim() || null,
        orgasmCount: Number.isFinite(orgasmCountNum) && orgasmCountNum >= 0 ? orgasmCountNum : 0,
        isNsfw,
        studioName: studioName.trim() || null,
        performerNames,
        tagNames,
      };
      if ((video as { entityKind?: string } | null)?.entityKind === "video_episode") {
        (patch as Record<string, unknown>).seasonNumber = parseNullable(seasonNumber);
        (patch as Record<string, unknown>).episodeNumber = parseNullable(episodeNumber);
        (patch as Record<string, unknown>).absoluteEpisodeNumber = parseNullable(absoluteEpisodeNumber);
      }
      await updateVideo(id, patch);
      message = "Saved";
      await reload();
      editing = false;
      onSaved?.();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to save";
    } finally {
      saving = false;
    }
  }

  async function handleThumbnailPick() {
    const file = thumbnailInput?.files?.[0];
    if (!file) return;
    uploadingThumb = true;
    error = null;
    try {
      await uploadVideoThumbnail(id, file);
      await reload();
      onSaved?.();
      message = "Thumbnail updated";
    } catch (err) {
      error = err instanceof Error ? err.message : "Upload failed";
    } finally {
      uploadingThumb = false;
      if (thumbnailInput) thumbnailInput.value = "";
    }
  }

  async function handleClearThumbnail() {
    uploadingThumb = true;
    error = null;
    try {
      await deleteVideoThumbnail(id);
      await reload();
      onSaved?.();
      message = "Reverted to generated thumbnail";
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to clear thumbnail";
    } finally {
      uploadingThumb = false;
    }
  }

  async function handleThumbnailFromCurrentFrame() {
    if (playbackFrameTime == null) {
      error = "Current playback frame is unavailable";
      return;
    }
    const seconds = Math.max(0, playbackFrameTime);
    generatingFrameThumb = true;
    error = null;
    try {
      await generateVideoThumbnailFromFrame(id, seconds);
      await reload();
      onSaved?.();
      message = `Thumbnail captured at ${formatSecondsLabel(seconds)}`;
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to capture thumbnail";
    } finally {
      generatingFrameThumb = false;
    }
  }

</script>

{#if loading}
  <div class="flex items-center justify-center py-32">
    <Loader2 class="h-8 w-8 text-text-accent animate-spin" />
  </div>
{:else if !video}
  <div class="surface-well flex flex-col items-center justify-center py-16">
    <p class="text-text-muted text-sm">{error ?? `${terms.video} not found`}</p>
  </div>
{:else}
  {@const v = video}
  <div class={cn("space-y-4", inline ? "" : "max-w-4xl")}>
    {#if !editing}
      {#if message}
        <div class="surface-well p-2.5 text-sm border border-border-accent text-text-secondary">
          {message}
        </div>
      {/if}

      <div class="flex items-center justify-between">
        <h3 class="text-kicker flex items-center gap-2">
          <FileText class="h-3.5 w-3.5" />
          {terms.video} Metadata
        </h3>
        <Button variant="secondary" size="sm" onclick={enterEditMode}>
          {#snippet children()}
            <Pencil class="h-3.5 w-3.5" />
            Edit
          {/snippet}
        </Button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div class="lg:col-span-2 surface-card-sharp no-lift p-4 space-y-4">
          <div class="space-y-1">
            <div class="flex items-center gap-1.5 text-[0.7rem] uppercase tracking-[0.14em] text-text-muted">
              <FileText class="h-3 w-3" /> Title
            </div>
            <p class="text-sm font-medium">{v.title}</p>
          </div>

          <div class="space-y-1">
            <div class="flex items-center gap-1.5 text-[0.7rem] uppercase tracking-[0.14em] text-text-muted">
              <Building2 class="h-3 w-3" /> Studio
            </div>
            {#if v.studio}
              <span class="text-sm text-text-accent font-medium">{v.studio.name}</span>
            {:else}
              <span class="text-sm text-text-disabled">--</span>
            {/if}
          </div>

          <div class="space-y-1">
            <div class="flex items-center gap-1.5 text-[0.7rem] uppercase tracking-[0.14em] text-text-muted">
              <Calendar class="h-3 w-3" /> Date
            </div>
            <span class="text-sm text-text-secondary">
              {v.date ?? "--"}
            </span>
          </div>

          {#if (v as { entityKind?: string }).entityKind === "video_episode"}
            <div class="space-y-1">
              <div class="flex items-center gap-1.5 text-[0.7rem] uppercase tracking-[0.14em] text-text-muted">
                <Tv class="h-3 w-3" /> Episode
              </div>
              <span class="text-sm text-text-secondary font-mono">
                {#if v.seasonNumber != null}
                  {v.seasonNumber === 0 ? "Specials" : `S${String(v.seasonNumber).padStart(2, "0")}`}
                {/if}
                {#if v.seasonNumber != null && v.episodeNumber != null}{" "}{/if}
                {#if v.episodeNumber != null}
                  E{String(v.episodeNumber).padStart(2, "0")}
                {/if}
                {#if v.seasonNumber == null && v.episodeNumber == null}
                  <span class="text-text-disabled">--</span>
                {/if}
              </span>
            </div>
          {/if}

          <div class="space-y-1">
            <div class="flex items-center gap-1.5 text-[0.7rem] uppercase tracking-[0.14em] text-text-muted">
              <Link2 class="h-3 w-3" /> URL
            </div>
            {#if v.url}
              <a
                href={v.url}
                target="_blank"
                rel="noopener noreferrer"
                class="text-sm text-text-accent hover:text-text-accent-bright truncate block"
              >{v.url}</a>
            {:else}
              <span class="text-sm text-text-disabled">--</span>
            {/if}
          </div>

          <div class="space-y-1">
            <div class="flex items-center gap-1.5 text-[0.7rem] uppercase tracking-[0.14em] text-text-muted">
              <FileText class="h-3 w-3" /> Details
            </div>
            {#if v.details}
              <p class="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
                {v.details}
              </p>
            {:else}
              <span class="text-sm text-text-disabled">--</span>
            {/if}
          </div>

          <div class="space-y-1">
            <div class="flex items-center gap-1.5 text-[0.7rem] uppercase tracking-[0.14em] text-text-muted">
              <User class="h-3 w-3" /> {terms.performers}
            </div>
            {#if v.performers.length === 0}
              <span class="text-sm text-text-disabled">--</span>
            {:else}
              <div class="flex flex-wrap gap-1.5">
                {#each v.performers as p (p.id)}
                  <a
                    href={`/performers/${p.id}`}
                    class="inline-flex items-center gap-1.5 tag-chip tag-chip-default hover:tag-chip-accent transition-colors cursor-pointer"
                  >
                    {#if p.imagePath}
                      <img src={toApiUrl(p.imagePath)} alt="" class="h-4 w-3 object-cover flex-shrink-0" loading="lazy" />
                    {/if}
                    {p.name}
                  </a>
                {/each}
              </div>
            {/if}
          </div>

          <div class="space-y-1">
            <div class="flex items-center gap-1.5 text-[0.7rem] uppercase tracking-[0.14em] text-text-muted">
              <TagIcon class="h-3 w-3" /> Tags
            </div>
            {#if v.tags.length === 0}
              <span class="text-sm text-text-disabled">--</span>
            {:else}
              <div class="flex flex-wrap gap-1.5">
                {#each v.tags as tag (tag.id)}
                  <a
                    href={`/tags/${encodeURIComponent(tag.name)}`}
                    class="tag-chip tag-chip-default hover:tag-chip-accent transition-colors cursor-pointer"
                  >
                    <NsfwTagLabel isNsfw={tag.isNsfw} text={tag.name} />
                  </a>
                {/each}
              </div>
            {/if}
          </div>

          <div class="space-y-1">
            <div class="flex items-center gap-1.5 text-[0.7rem] uppercase tracking-[0.14em] text-text-muted">
              {#if explicitCounterLabels}<Droplets class="h-3 w-3" />{:else}<Heart class="h-3 w-3" />{/if}
              {explicitCounterLabels ? "Orgasms" : "Likes"}
            </div>
            <span class="text-mono-sm">{v.orgasmCount || 0}</span>
          </div>

          <div class="space-y-1">
            <div class="flex items-center gap-1.5 text-[0.7rem] uppercase tracking-[0.14em] text-text-muted">
              <CheckCircle2 class="h-3 w-3" /> Organized
            </div>
            <span class={cn("text-mono-sm", v.organized ? "text-success-text" : "text-text-disabled")}>
              {v.organized ? "Yes" : "No"}
            </span>
          </div>
        </div>

        <div class="space-y-3">
          <h4 class="text-kicker flex items-center gap-2">
            <ImageIcon class="h-3.5 w-3.5" />
            Thumbnail
          </h4>
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="relative group aspect-video surface-well overflow-hidden cursor-pointer"
            onclick={enterEditMode}
          >
            {#if v.thumbnailPath}
              <img src={toApiUrl(v.thumbnailPath)} alt={v.title} class="w-full h-full object-cover" />
            {:else}
              <div class="w-full h-full flex items-center justify-center gradient-thumb-3">
                <ImageIcon class="h-8 w-8 text-text-disabled" />
              </div>
            {/if}
            <div class="thumb-edit-overlay">
              <Pencil class="h-5 w-5 text-text-primary" />
              <span class="text-xs text-text-muted">Edit to change</span>
            </div>
          </div>
        </div>
      </div>
    {:else}
      <!-- EDIT MODE -->
      {#if message}
        <div class="surface-well p-2.5 text-sm border border-border-accent text-text-secondary">
          {message}
        </div>
      {/if}

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div class="lg:col-span-2">
          <EditFormShell
            title="Edit {terms.video.toLowerCase()}"
            onSave={() => void handleSave()}
            onCancel={cancelEdit}
            {saving}
            saveDisabled={!title.trim()}
            saveLabel="Save changes"
            {error}
          >
            <TextField
              label="Title"
              icon={FileText}
              value={title}
              onChange={(v2) => (title = v2)}
              placeholder={`${terms.video} title`}
              required
            />
            <SearchSelect
              label="Studio"
              icon={Building2}
              value={studioName}
              onChange={(v2) => (studioName = v2)}
              options={studioSuggestions}
              placeholder="Pick a studio…"
              canAddNew
            />
            <div class="grid gap-4 sm:grid-cols-2">
              <DateField
                label="Date"
                icon={Calendar}
                value={date}
                onChange={(v2) => (date = v2)}
              />
              <TextField
                label="URL"
                icon={Link2}
                value={url}
                onChange={(v2) => (url = v2)}
                type="url"
                placeholder="https://…"
              />
            </div>
            <TextAreaField
              label="Details"
              value={details}
              onChange={(v2) => (details = v2)}
              placeholder="Synopsis or notes"
            />
            <TagSelect
              label={terms.performers}
              icon={User}
              values={performerNames}
              onChange={(next) => (performerNames = next)}
              options={performerSuggestions}
              placeholder={`Add ${terms.performer.toLowerCase()}…`}
            />
            <TagSelect
              label="Tags"
              icon={TagIcon}
              values={tagNames}
              onChange={(next) => (tagNames = next)}
              options={tagSuggestions}
              placeholder="Add tag…"
            />
            <div class="grid gap-4 sm:grid-cols-2">
              <TextField
                label={explicitCounterLabels ? "Orgasm count" : "Like count"}
                icon={explicitCounterLabels ? Droplets : Heart}
                value={orgasmCountStr}
                onChange={(v2) => (orgasmCountStr = v2)}
                type="number"
                min={0}
              />
              <div class="flex items-end">
                <ToggleChip
                  value={isNsfw}
                  onChange={(v2) => (isNsfw = v2)}
                  onLabel="Marked NSFW"
                  offLabel="Mark as NSFW"
                  icon={AlertTriangle}
                  variant="warning"
                />
              </div>
            </div>
            {#if (v as { entityKind?: string }).entityKind === "video_episode"}
              <div class="grid gap-4 sm:grid-cols-3 pt-2 border-t border-border-subtle">
                <TextField
                  label="Season"
                  icon={Tv}
                  value={seasonNumber}
                  onChange={(v2) => (seasonNumber = v2)}
                  type="number"
                  min={0}
                  placeholder="—"
                />
                <TextField
                  label="Episode"
                  icon={Clapperboard}
                  value={episodeNumber}
                  onChange={(v2) => (episodeNumber = v2)}
                  type="number"
                  min={0}
                  placeholder="—"
                />
                <TextField
                  label="Absolute"
                  value={absoluteEpisodeNumber}
                  onChange={(v2) => (absoluteEpisodeNumber = v2)}
                  type="number"
                  min={0}
                  placeholder="—"
                />
              </div>
            {/if}
          </EditFormShell>
        </div>

        <div class="space-y-3">
          <h4 class="text-kicker flex items-center gap-2">
            <ImageIcon class="h-3.5 w-3.5" />
            Thumbnail
          </h4>
          <div class="relative aspect-video surface-well overflow-hidden">
            {#if v.thumbnailPath}
              <img src={toApiUrl(v.thumbnailPath)} alt={v.title} class="w-full h-full object-cover" />
            {:else}
              <div class="w-full h-full flex items-center justify-center gradient-thumb-3">
                <ImageIcon class="h-8 w-8 text-text-disabled" />
              </div>
            {/if}
          </div>
          <input
            bind:this={thumbnailInput}
            type="file"
            accept="image/*"
            class="hidden"
            onchange={handleThumbnailPick}
          />
          <div class="flex flex-col gap-2">
            <button
              type="button"
              onclick={() => thumbnailInput?.click()}
              disabled={uploadingThumb}
              class="flex items-center justify-center gap-1.5 border border-border-default px-3 py-1.5 text-[0.78rem] hover:border-border-accent hover:text-text-accent transition-colors disabled:opacity-60"
            >
              {#if uploadingThumb}
                <Loader2 class="h-3.5 w-3.5 animate-spin" />
              {:else}
                <Upload class="h-3.5 w-3.5" />
              {/if}
              Upload thumbnail
            </button>
            <button
              type="button"
              onclick={() => void handleThumbnailFromCurrentFrame()}
              disabled={generatingFrameThumb || !hasPlaybackFrameTime}
              class="flex items-center justify-center gap-1.5 border border-border-default px-3 py-1.5 text-[0.78rem] hover:border-border-accent hover:text-text-accent transition-colors disabled:opacity-60"
            >
              {#if generatingFrameThumb}
                <Loader2 class="h-3.5 w-3.5 animate-spin" />
              {:else}
                <ImageIcon class="h-3.5 w-3.5" />
              {/if}
              Use current frame
            </button>
            {#if hasCustomThumbnail}
              <button
                type="button"
                onclick={() => void handleClearThumbnail()}
                disabled={uploadingThumb}
                class="flex items-center justify-center gap-1.5 border border-border-default px-3 py-1.5 text-[0.78rem] text-text-muted hover:border-error-text hover:text-error-text transition-colors disabled:opacity-60"
              >
                <X class="h-3.5 w-3.5" />
                Revert to generated
              </button>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </div>
{/if}
