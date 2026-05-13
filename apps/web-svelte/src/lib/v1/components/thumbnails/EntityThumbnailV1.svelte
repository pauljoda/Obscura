<script lang="ts">
  import VideoThumbnail from "./VideoThumbnailV1.svelte";
  import SeriesThumbnail from "./SeriesThumbnailV1.svelte";
  import GalleryThumbnail from "./GalleryThumbnailV1.svelte";
  import ImageThumbnail from "./ImageThumbnailV1.svelte";
  import PerformerThumbnail from "./PerformerThumbnailV1.svelte";
  import StudioThumbnail from "./StudioThumbnailV1.svelte";
  import TagThumbnail from "./TagThumbnailV1.svelte";
  import CollectionThumbnail from "./CollectionThumbnailV1.svelte";
  import AudioLibraryThumbnail from "./AudioLibraryThumbnailV1.svelte";
  import AudioTrackThumbnail from "./AudioTrackThumbnailV1.svelte";
  import type { EntityThumbnailProps } from "./thumbnail-types-v1";

  let props: EntityThumbnailProps = $props();
</script>

{#if props.kind === "video"}
  <VideoThumbnail
    video={props.video}
    size={props.size}
    imageLoading={props.imageLoading ?? props.loading}
    gradient={props.gradientFallback}
    rating={props.rating}
    class={props.class}
  />
{:else if props.kind === "video-series"}
  <SeriesThumbnail
    title={props.title}
    coverImagePath={props.coverImagePath}
    previewThumbnailPaths={props.previewThumbnailPaths}
    updatedAt={props.updatedAt}
    isNsfw={props.isNsfw ?? false}
    videoCount={props.videoCount}
    rating={props.rating}
    loading={props.loading}
    showCount={props.showCount}
    class={props.class}
  />
{:else if props.kind === "gallery"}
  <GalleryThumbnail
    title={props.title}
    coverImagePath={props.coverImagePath}
    previewImagePaths={props.previewImagePaths}
    imageCount={props.imageCount}
    isNsfw={props.isNsfw ?? false}
    isComic={props.isComic ?? false}
    updatedAt={props.updatedAt}
    size={props.size}
    aspectClass={props.aspectClass}
    aspectRatio={props.aspectRatio}
    loading={props.loading}
    fit={props.fit}
    class={props.class}
    gradientFallback={props.gradientFallback}
    showCount={props.showCount}
    rating={props.rating}
    stacked={props.stacked}
    gradientIndex={props.gradientIndex}
  />
{:else if props.kind === "book"}
  <GalleryThumbnail
    title={props.title}
    coverImagePath={props.coverImagePath}
    previewImagePaths={props.previewImagePaths}
    imageCount={props.pageCount}
    isNsfw={props.isNsfw ?? false}
    updatedAt={props.updatedAt}
    size={props.size}
    aspectClass={props.aspectClass}
    aspectRatio={props.aspectRatio}
    loading={props.loading}
    fit={props.fit ?? "contain"}
    class={props.class}
    gradientFallback={props.gradientFallback}
    showCount={props.showCount}
    rating={props.rating}
    gradientIndex={props.gradientIndex}
  />
{:else if props.kind === "image"}
  <ImageThumbnail
    title={props.title}
    thumbnailPath={props.thumbnailPath}
    previewPath={props.previewPath}
    isNsfw={props.isNsfw ?? false}
    isVideo={props.isVideo ?? false}
    width={props.width}
    height={props.height}
    updatedAt={props.updatedAt}
    size={props.size}
    aspectClass={props.aspectClass}
    loading={props.loading}
    rating={props.rating}
    class={props.class}
    showChips={props.showChips}
  />
{:else if props.kind === "performer"}
  <PerformerThumbnail
    performer={props.performer}
    gradientFallback={props.gradientFallback}
    loading={props.loading}
    class={props.class}
    showChips={props.showChips}
    compact={props.compact}
  />
{:else if props.kind === "studio"}
  <StudioThumbnail
    studio={props.studio}
    size={props.size}
    aspectClass={props.aspectClass}
    loading={props.loading}
    class={props.class}
    showChips={props.showChips}
    gradientIndex={props.gradientIndex}
  />
{:else if props.kind === "tag"}
  <TagThumbnail
    tag={props.tag}
    size={props.size}
    aspectClass={props.aspectClass}
    loading={props.loading}
    class={props.class}
    showLabel={props.showLabel}
    muted={props.muted}
    cacheBust={props.cacheBust}
  />
{:else if props.kind === "collection"}
  <CollectionThumbnail
    collection={{ ...props.collection, isNsfw: props.collection.isNsfw === true }}
    size={props.size}
    aspectClass={props.aspectClass}
    loading={props.loading}
    class={props.class}
    gradientIndex={props.gradientIndex}
  />
{:else if props.kind === "audio-library"}
  <AudioLibraryThumbnail
    library={props.library}
    size={props.size}
    aspectClass={props.aspectClass}
    loading={props.loading}
    class={props.class}
    showChips={props.showChips}
    showPlayOverlay={props.showPlayOverlay}
    gradientIndex={props.gradientIndex}
  />
{:else if props.kind === "audio-track"}
  <AudioTrackThumbnail
    track={props.track}
    size={props.size}
    aspectClass={props.aspectClass}
    loading={props.loading}
    class={props.class}
    showChips={props.showChips}
    showPlayOverlay={props.showPlayOverlay}
    gradientIndex={props.gradientIndex}
  />
{/if}
