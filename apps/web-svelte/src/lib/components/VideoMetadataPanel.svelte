<script lang="ts">
  import { Monitor, HardDrive, FileVideo, Link2, Zap, Play, Tv } from "@lucide/svelte";
  import type { VideoDetailDto } from "@obscura/contracts";
  import MetadataPanel from "./MetadataPanel.svelte";
  import PerformersSection from "./PerformersSection.svelte";
  import TagsSection from "./TagsSection.svelte";
  import InfoRow from "./InfoRow.svelte";

  interface Props {
    video: VideoDetailDto;
  }

  let { video }: Props = $props();

  function formatBitRate(bps: number | null | undefined): string {
    if (!bps) return "\u2014";
    if (bps >= 1000000) return `${(bps / 1000000).toFixed(1)} Mbps`;
    return `${(bps / 1000).toFixed(0)} Kbps`;
  }

  function formatEpisodeLabel(
    seasonNumber: number | null,
    episodeNumber: number | null,
    absoluteEpisodeNumber: number | null,
  ): string {
    const parts: string[] = [];
    if (seasonNumber != null) {
      parts.push(
        seasonNumber === 0 ? "Specials" : `S${String(seasonNumber).padStart(2, "0")}`,
      );
    }
    if (episodeNumber != null) {
      parts.push(`E${String(episodeNumber).padStart(2, "0")}`);
    }
    if (absoluteEpisodeNumber != null && episodeNumber == null) {
      parts.push(`Abs ${absoluteEpisodeNumber}`);
    } else if (absoluteEpisodeNumber != null) {
      parts.push(`· Abs ${absoluteEpisodeNumber}`);
    }
    return parts.length > 0 ? parts.join(" ") : "\u2014";
  }

  const isEpisode = $derived((video as { entityKind?: string }).entityKind === "video_episode");
  const hasEpisodeMeta = $derived(
    isEpisode &&
      (video.seasonNumber != null ||
        video.episodeNumber != null ||
        (video as { absoluteEpisodeNumber?: number | null }).absoluteEpisodeNumber != null),
  );
</script>

<MetadataPanel>
  {#snippet children()}
    <PerformersSection
      performers={video.performers}
      parentIsNsfw={video.isNsfw}
    />
    <TagsSection tags={video.tags} />
  {/snippet}
  {#snippet sidebar()}
    <h4 class="text-kicker">File Information</h4>
    <div class="space-y-2.5">
      {#if hasEpisodeMeta}
        <InfoRow
          icon={Tv}
          label="Episode"
          value={formatEpisodeLabel(
            video.seasonNumber ?? null,
            video.episodeNumber ?? null,
            (video as { absoluteEpisodeNumber?: number | null }).absoluteEpisodeNumber ?? null,
          )}
        />
      {/if}
      <InfoRow
        icon={Monitor}
        label="Resolution"
        value={video.width && video.height ? `${video.width}x${video.height}` : "\u2014"}
      />
      <InfoRow
        icon={FileVideo}
        label="Codec"
        value={[video.codec, video.container?.toUpperCase()].filter(Boolean).join(" / ") || "\u2014"}
      />
      <InfoRow
        icon={HardDrive}
        label="Size"
        value={video.fileSizeFormatted ?? "\u2014"}
      />
      <InfoRow icon={Link2} label="Bitrate" value={formatBitRate(video.bitRate)} />
      <InfoRow
        icon={Zap}
        label="Framerate"
        value={video.frameRate ? `${video.frameRate} fps` : "\u2014"}
      />
      <InfoRow icon={Play} label="Play Count" value={String(video.playCount)} />
    </div>
  {/snippet}
</MetadataPanel>
