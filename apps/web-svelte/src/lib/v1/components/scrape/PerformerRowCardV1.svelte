<script lang="ts">
  import {
    Check,
    X,
    Loader2,
    ChevronDown,
  } from "@lucide/svelte";
  import { Badge, cn } from "@obscura/ui-svelte";
  import EntityThumbnail from "$lib/v1/components/thumbnails/EntityThumbnailV1.svelte";
  import { entityTerms } from "$lib/terminology";
  import type { PerformerRow } from "$lib/v1/identify/scrape-types-v1";
  import StatusDot from "./StatusDotV1.svelte";
  import ToggleableField from "./ToggleableFieldV1.svelte";
  import ImagePickerModal from "$lib/components/ImagePickerModal.svelte";

  interface Props {
    row: PerformerRow;
    expanded: boolean;
    onToggleExpand: () => void;
    onAccept: (imageUrl?: string) => void;
    onReject: () => void;
    onToggleField: (field: string) => void;
  }

  let { row, expanded, onToggleExpand, onAccept, onReject, onToggleField }: Props = $props();

  let selectedImageIndex = $state(0);
  let imagePickerOpen = $state(false);

  const allImages = $derived.by(() => {
    if (!row.result) return [] as string[];
    return [
      ...new Set(
        [
          ...(row.result.imageUrl ? [row.result.imageUrl] : []),
          ...(row.result.imageUrls ?? []),
        ].filter((u) => u.startsWith("http") || u.startsWith("data:image/")),
      ),
    ];
  });

  const effectiveImageUrl = $derived(
    allImages[selectedImageIndex] ?? allImages[0] ?? null,
  );
</script>

<div>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <div
    onclick={onToggleExpand}
    role="button"
    tabindex="0"
    onkeydown={(e) => {
      if (e.key === "Enter" || e.key === " ") onToggleExpand();
    }}
    class={cn(
      "surface-card no-lift flex items-center gap-3 px-3 py-2.5 transition-all duration-fast cursor-pointer",
      expanded && "border-border-accent/40",
      row.status === "accepted" && "opacity-50",
      row.status === "rejected" && "opacity-30",
    )}
  >
    <StatusDot status={row.status} />

    <div class="flex-shrink-0 h-10 w-8 overflow-hidden bg-surface-3">
      <EntityThumbnail
        kind="performer"
        performer={row.performer}
        compact
        showChips={false}
        class="h-full w-full"
      />
    </div>

    <div class="flex-1 min-w-0">
      <div class="text-[0.8rem] font-medium text-text-primary truncate">
        {row.performer.name}
      </div>
      {#if row.result && (row.status === "found" || row.status === "accepted")}
        <div class="text-[0.62rem] text-text-muted truncate mt-0.5">
          {[row.result.gender, row.result.country, row.result.birthdate]
            .filter(Boolean)
            .join(" | ")}
        </div>
      {/if}
      {#if row.matchedScraper && row.status !== "pending"}
        <span class="text-text-disabled text-[0.58rem] font-mono">via {row.matchedScraper}</span>
      {/if}
    </div>

    <div class="flex items-center gap-1.5 flex-shrink-0">
      {#if row.status === "scraping"}
        <Loader2 class="h-3.5 w-3.5 text-text-accent animate-spin" />
      {/if}
      {#if row.status === "found"}
        <button
          type="button"
          onclick={(e) => {
            e.stopPropagation();
            onAccept(effectiveImageUrl ?? undefined);
          }}
          class="flex items-center gap-1 px-2 py-1 text-[0.62rem] text-status-success-text border border-status-success/25 hover:bg-status-success/10 transition-colors"
        >
          <Check class="h-2.5 w-2.5" />
          Accept
        </button>
        <button
          type="button"
          onclick={(e) => {
            e.stopPropagation();
            onReject();
          }}
          aria-label="Reject"
          class="p-1 text-text-disabled hover:text-status-error-text transition-colors"
        >
          <X class="h-3 w-3" />
        </button>
      {/if}
      {#if row.status === "no-result"}
        <span class="text-[0.62rem] text-text-disabled">No result</span>
      {/if}
      {#if row.status === "error"}
        <span class="text-[0.62rem] text-status-error-text">Error</span>
      {/if}
      {#if row.status === "accepted"}
        <Badge variant="accent" class="text-[0.55rem]">
          {#snippet children()}Applied{/snippet}
        </Badge>
      {/if}
      {#if row.status === "rejected"}
        <span class="text-[0.62rem] text-text-disabled">Skipped</span>
      {/if}
    </div>

    <ChevronDown
      class={cn(
        "h-3 w-3 text-text-disabled flex-shrink-0 transition-transform duration-fast",
        expanded && "rotate-180",
      )}
    />
  </div>

  {#if expanded && row.result}
    {@const r = row.result}
    <div class="surface-card no-lift ml-6 mr-1 mb-1 p-3 border-border-accent/20">
      <div class="flex gap-4">
        {#if allImages.length > 0}
          <div class="flex-shrink-0 space-y-2 flex flex-col items-center">
            <button
              type="button"
              onclick={(e) => {
                e.stopPropagation();
                if (allImages.length > 1) imagePickerOpen = true;
              }}
              class="w-24 h-32 overflow-hidden bg-surface-3 border border-border-subtle hover:border-border-accent transition-all"
              aria-label="Browse performer images"
            >
              {#if effectiveImageUrl}
                <img src={effectiveImageUrl} alt="" class="w-full h-full object-cover" />
              {/if}
            </button>
            {#if allImages.length > 1}
              <button
                type="button"
                onclick={(e) => {
                  e.stopPropagation();
                  imagePickerOpen = true;
                }}
                class="text-[0.6rem] text-text-accent hover:text-text-accent-bright transition-colors text-center"
              >
                Browse all ({allImages.length})
              </button>
            {/if}
            {#if imagePickerOpen}
              <ImagePickerModal
                images={allImages}
                selectedIndex={selectedImageIndex}
                onSelect={(i) => (selectedImageIndex = i)}
                onClose={() => (imagePickerOpen = false)}
                title={`Select ${entityTerms.performer} image`}
              />
            {/if}
          </div>
        {/if}

        <div class="flex-1 min-w-0">
          <div class="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-[0.8rem]">
            {#if r.name}
              <ToggleableField field="name" label="Name" value={r.name} enabled={row.selectedFields.has("name")} onToggle={() => onToggleField("name")} />
            {/if}
            {#if r.gender}
              <ToggleableField field="gender" label="Gender" value={r.gender} enabled={row.selectedFields.has("gender")} onToggle={() => onToggleField("gender")} />
            {/if}
            {#if r.birthdate}
              <ToggleableField field="birthdate" label="Birthdate" value={r.birthdate} enabled={row.selectedFields.has("birthdate")} onToggle={() => onToggleField("birthdate")} />
            {/if}
            {#if r.country}
              <ToggleableField field="country" label="Country" value={r.country} enabled={row.selectedFields.has("country")} onToggle={() => onToggleField("country")} />
            {/if}
            {#if r.ethnicity}
              <ToggleableField field="ethnicity" label="Ethnicity" value={r.ethnicity} enabled={row.selectedFields.has("ethnicity")} onToggle={() => onToggleField("ethnicity")} />
            {/if}
            {#if r.height}
              <ToggleableField field="height" label="Height" value={r.height} enabled={row.selectedFields.has("height")} onToggle={() => onToggleField("height")} />
            {/if}
            {#if r.weight}
              <ToggleableField field="weight" label="Weight" value={String(r.weight)} enabled={row.selectedFields.has("weight")} onToggle={() => onToggleField("weight")} />
            {/if}
            {#if r.hairColor}
              <ToggleableField field="hairColor" label="Hair" value={r.hairColor} enabled={row.selectedFields.has("hairColor")} onToggle={() => onToggleField("hairColor")} />
            {/if}
            {#if r.eyeColor}
              <ToggleableField field="eyeColor" label="Eyes" value={r.eyeColor} enabled={row.selectedFields.has("eyeColor")} onToggle={() => onToggleField("eyeColor")} />
            {/if}
            {#if r.measurements}
              <ToggleableField field="measurements" label="Measurements" value={r.measurements} enabled={row.selectedFields.has("measurements")} onToggle={() => onToggleField("measurements")} />
            {/if}
            {#if r.aliases}
              <ToggleableField field="aliases" label="Aliases" value={r.aliases} enabled={row.selectedFields.has("aliases")} onToggle={() => onToggleField("aliases")} />
            {/if}
            {#if r.tattoos}
              <ToggleableField field="tattoos" label="Tattoos" value={r.tattoos} enabled={row.selectedFields.has("tattoos")} onToggle={() => onToggleField("tattoos")} />
            {/if}
            {#if r.piercings}
              <ToggleableField field="piercings" label="Piercings" value={r.piercings} enabled={row.selectedFields.has("piercings")} onToggle={() => onToggleField("piercings")} />
            {/if}
            {#if r.tagNames.length > 0}
              <ToggleableField field="tagNames" label="Tags" value={r.tagNames.join(", ")} enabled={row.selectedFields.has("tagNames")} onToggle={() => onToggleField("tagNames")} />
            {/if}
            {#if allImages.length > 0}
              <ToggleableField field="imageUrl" label="Image" value={`${allImages.length} available`} enabled={row.selectedFields.has("imageUrl")} onToggle={() => onToggleField("imageUrl")} />
            {/if}
          </div>
          {#if r.details}
            <div class="mt-2">
              <ToggleableField
                field="details"
                label="Details"
                value={r.details.slice(0, 200) + (r.details.length > 200 ? "..." : "")}
                enabled={row.selectedFields.has("details")}
                onToggle={() => onToggleField("details")}
              />
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  {#if expanded && row.error}
    <div class="surface-card no-lift ml-6 mr-1 mb-1 p-3 border-status-error/20">
      <p class="text-[0.7rem] text-status-error-text">{row.error}</p>
    </div>
  {/if}
</div>
