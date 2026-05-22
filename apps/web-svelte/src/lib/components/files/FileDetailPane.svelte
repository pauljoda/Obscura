<script lang="ts">
  import {
    FileArchive,
    FilePlus2,
    FolderPlus,
    Image as ImageIcon,
    Pencil,
    RefreshCw,
    ScanLine,
    Trash2,
    Upload,
  } from "@lucide/svelte";
  import type { V2FileDetail } from "$lib/api/v2";
  import { v2FileContentUrl } from "$lib/api/v2";
  import type { FileActionId } from "$lib/files/file-actions";

  interface Props {
    detail: V2FileDetail | null;
    loading?: boolean;
    error?: string | null;
    mobile?: boolean;
    onBack?: () => void;
    onRefresh?: () => void;
    onAction?: (action: FileActionId) => void;
    onUploadFiles?: (files: FileList | null) => void;
    onUploadFolder?: (files: FileList | null) => void;
    onExternalDrop?: (dataTransfer: DataTransfer | null) => void;
  }

  let {
    detail,
    loading = false,
    error = null,
    mobile = false,
    onBack,
    onRefresh,
    onAction,
    onUploadFiles,
    onUploadFolder,
    onExternalDrop,
  }: Props = $props();

  let fileInput = $state<HTMLInputElement>();
  let folderInput = $state<HTMLInputElement>();
  let textPreview = $state<string | null>(null);
  let previewError = $state<string | null>(null);

  const entry = $derived(detail?.entry ?? null);
  const isDirectory = $derived(entry?.kind === "directory");
  const contentUrl = $derived(entry ? v2FileContentUrl(entry.rootId, entry.path) : "");
  const mime = $derived(entry?.mimeType ?? "");
  const previewKind = $derived(resolvePreviewKind(entry?.name ?? "", mime, isDirectory));

  function resolvePreviewKind(name: string, mimeType: string, directory: boolean): "image" | "video" | "audio" | "text" | "none" {
    if (directory) return "none";
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType.startsWith("audio/")) return "audio";
    if (mimeType.startsWith("text/")) return "text";
    if (/\.(json|md|markdown|xml|srt|vtt|log|txt|csv|nfo)$/i.test(name)) return "text";
    return "none";
  }

  function formatBytes(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === "") return "—";
    const bytes = typeof value === "string" ? Number.parseInt(value, 10) : value;
    if (!Number.isFinite(bytes)) return "—";
    if (bytes < 1024) return `${bytes} B`;
    const units = ["KB", "MB", "GB", "TB"];
    let size = bytes / 1024;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
      size /= 1024;
      unit += 1;
    }
    return `${size.toFixed(size >= 100 ? 0 : 1)} ${units[unit]}`;
  }

  function formatDate(value: string | null | undefined): string {
    if (!value) return "—";
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  }

  function handleDragOver(event: DragEvent): void {
    if (!event.dataTransfer?.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function handleDrop(event: DragEvent): void {
    if (!event.dataTransfer?.types.includes("Files")) return;
    event.preventDefault();
    onExternalDrop?.(event.dataTransfer);
  }

  $effect(() => {
    textPreview = null;
    previewError = null;
    if (previewKind !== "text" || !contentUrl) return;

    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(contentUrl, {
          headers: { Range: "bytes=0-262143" },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Preview ${response.status}`);
        const text = await response.text();
        textPreview = text.length > 262144 ? `${text.slice(0, 262144)}\n...` : text;
      } catch (previewLoadError) {
        if (!controller.signal.aborted) {
          previewError = previewLoadError instanceof Error ? previewLoadError.message : "Preview failed";
        }
      }
    })();

    return () => controller.abort();
  });
</script>

<section class="detail-pane" aria-label="File details" ondragover={handleDragOver} ondrop={handleDrop}>
  <div class="detail-header">
    {#if mobile}
      <button class="icon-button" type="button" onclick={onBack} aria-label="Back to folders">←</button>
    {/if}
    <div class="title-lockup">
      <span>{isDirectory ? "Folder" : "File"}</span>
      <h1>{entry?.name ?? "Select a file"}</h1>
      {#if entry}
        <p>{entry.path || "Root"}</p>
      {/if}
    </div>
    <button class="icon-button" type="button" onclick={onRefresh} aria-label="Refresh details">
      <RefreshCw class="h-4 w-4" />
    </button>
  </div>

  {#if error}
    <div class="state-panel error">{error}</div>
  {:else if loading}
    <div class="state-panel">Loading...</div>
  {:else if !detail || !entry}
    <div class="state-panel">Choose a watched root or file.</div>
  {:else}
    <div class="actions">
      {#if isDirectory}
        <button type="button" onclick={() => fileInput?.click()}><Upload class="h-4 w-4" />Files</button>
        <button type="button" onclick={() => folderInput?.click()}><FilePlus2 class="h-4 w-4" />Folder upload</button>
        <button type="button" onclick={() => onAction?.("new-folder")}><FolderPlus class="h-4 w-4" />New folder</button>
        <button type="button" onclick={() => onAction?.("rescan")}><ScanLine class="h-4 w-4" />Rescan</button>
      {/if}
      <button type="button" onclick={() => onAction?.("rename")}><Pencil class="h-4 w-4" />Rename</button>
      <button type="button" onclick={() => onAction?.("move")}><FileArchive class="h-4 w-4" />Move</button>
      <button class="danger" type="button" onclick={() => onAction?.("delete")}><Trash2 class="h-4 w-4" />Delete</button>
    </div>

    <input
      bind:this={fileInput}
      class="hidden-input"
      type="file"
      multiple
      onchange={(event) => onUploadFiles?.(event.currentTarget.files)}
    />
    <input
      bind:this={folderInput}
      class="hidden-input"
      type="file"
      multiple
      webkitdirectory
      onchange={(event) => onUploadFolder?.(event.currentTarget.files)}
    />

    <div class="meta-grid">
      <div><span>Size</span><strong>{formatBytes(entry.sizeBytes)}</strong></div>
      <div><span>Kind</span><strong>{entry.kind}</strong></div>
      <div><span>Modified</span><strong>{formatDate(entry.modifiedAt)}</strong></div>
      <div><span>Created</span><strong>{formatDate(detail.createdAt)}</strong></div>
      <div><span>MIME</span><strong>{entry.mimeType ?? "—"}</strong></div>
      <div><span>Linked</span><strong>{detail.linkedEntities.length}</strong></div>
    </div>

    {#if detail.linkedEntities.length > 0}
      <div class="linked-strip">
        {#each detail.linkedEntities as linked (linked.entityId)}
          <a href={`/${linked.kind}/${linked.entityId}`}>{linked.title}</a>
        {/each}
      </div>
    {/if}

    <div class="preview" data-kind={previewKind}>
      {#if previewKind === "image"}
        <img src={contentUrl} alt={entry.name} />
      {:else if previewKind === "video"}
        <!-- svelte-ignore a11y_media_has_caption -->
        <video src={contentUrl} controls preload="metadata"></video>
      {:else if previewKind === "audio"}
        <audio src={contentUrl} controls></audio>
      {:else if previewKind === "text"}
        {#if previewError}
          <div class="state-panel error">{previewError}</div>
        {:else}
          <pre>{textPreview ?? "Loading preview..."}</pre>
        {/if}
      {:else}
        <div class="empty-preview">
          <ImageIcon class="h-8 w-8" />
          <span>Preview unavailable</span>
        </div>
      {/if}
    </div>
  {/if}
</section>

<style>
  .detail-pane {
    display: grid;
    min-height: 0;
    grid-template-rows: auto auto auto auto 1fr;
    gap: 1rem;
    overflow: auto;
    padding: 1rem;
    background:
      linear-gradient(180deg, rgba(196, 154, 90, 0.055), transparent 16rem),
      var(--color-bg);
  }

  .detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    border-bottom: 1px solid rgba(196, 154, 90, 0.18);
    padding-bottom: 0.85rem;
  }

  .title-lockup {
    min-width: 0;
  }

  .title-lockup span,
  .meta-grid span {
    color: var(--color-text-muted);
    font-family: "JetBrains Mono", monospace;
    font-size: 0.68rem;
    text-transform: uppercase;
  }

  .title-lockup h1 {
    margin: 0.08rem 0 0;
    overflow-wrap: anywhere;
    color: var(--color-text-primary);
    font-family: Geist, Inter, sans-serif;
    font-size: clamp(1.25rem, 4vw, 2rem);
    line-height: 1.05;
  }

  .title-lockup p {
    margin: 0.3rem 0 0;
    overflow-wrap: anywhere;
    color: var(--color-text-muted);
    font-size: 0.78rem;
  }

  .icon-button,
  .actions button {
    border: 1px solid rgba(196, 154, 90, 0.22);
    border-radius: 0;
    background: rgba(255, 255, 255, 0.045);
    color: var(--color-text-primary);
  }

  .icon-button {
    display: grid;
    width: 2.35rem;
    height: 2.35rem;
    place-items: center;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .actions button {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 2.2rem;
    padding: 0.45rem 0.65rem;
    font-size: 0.78rem;
  }

  .actions button:hover,
  .icon-button:hover {
    border-color: rgba(196, 154, 90, 0.6);
    box-shadow: 0 0 18px rgba(196, 154, 90, 0.15);
  }

  .actions .danger {
    color: #f2a4a4;
  }

  .hidden-input {
    display: none;
  }

  .meta-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    border: 1px solid rgba(196, 154, 90, 0.14);
    background: rgba(255, 255, 255, 0.035);
  }

  .meta-grid div {
    min-width: 0;
    border-bottom: 1px solid rgba(196, 154, 90, 0.1);
    padding: 0.75rem;
  }

  .meta-grid strong {
    display: block;
    overflow-wrap: anywhere;
    margin-top: 0.3rem;
    color: var(--color-text-primary);
    font-size: 0.82rem;
  }

  .linked-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
  }

  .linked-strip a {
    border: 1px solid rgba(196, 154, 90, 0.2);
    color: var(--color-text-primary);
    padding: 0.35rem 0.55rem;
    text-decoration: none;
  }

  .preview {
    display: grid;
    min-height: 18rem;
    border: 1px solid rgba(196, 154, 90, 0.16);
    background: rgba(0, 0, 0, 0.22);
  }

  .preview img,
  .preview video {
    width: 100%;
    height: 100%;
    max-height: 62vh;
    object-fit: contain;
  }

  .preview audio {
    align-self: center;
    width: min(36rem, calc(100% - 2rem));
    margin: 1rem auto;
  }

  .preview pre {
    margin: 0;
    overflow: auto;
    padding: 1rem;
    color: var(--color-text-primary);
    font-size: 0.78rem;
    line-height: 1.55;
    white-space: pre-wrap;
  }

  .empty-preview,
  .state-panel {
    display: grid;
    min-height: 12rem;
    place-items: center;
    color: var(--color-text-muted);
    text-align: center;
  }

  .empty-preview {
    gap: 0.65rem;
    align-content: center;
  }

  .state-panel.error {
    color: #f2a4a4;
  }

  @media (min-width: 768px) {
    .detail-pane {
      padding: 1.25rem;
    }

    .meta-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
</style>
