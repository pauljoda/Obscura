<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import {
    loadTrickplayFrames,
    type TrickplayFrame,
  } from "@obscura/ui-svelte";

  interface SubtitleTrack {
    id: string;
    label: string;
    language?: string | null;
    src: string;
  }

  interface Props {
    src?: string | null;
    directSrc?: string | null;
    poster?: string | null;
    trickplaySprite?: string | null;
    trickplayVtt?: string | null;
    subtitles?: SubtitleTrack[];
    autoplay?: boolean;
    class?: string;
  }

  let {
    src,
    directSrc,
    poster,
    trickplaySprite,
    trickplayVtt,
    subtitles = [],
    autoplay = false,
    class: className,
  }: Props = $props();

  let videoEl: HTMLVideoElement | undefined = $state();
  let wrapperEl: HTMLDivElement | undefined = $state();
  let currentTime = $state(0);
  let duration = $state(0);
  let paused = $state(true);
  let muted = $state(false);
  let volume = $state(1);
  let hoverX: number | null = $state(null);
  let frames = $state<TrickplayFrame[] | null>(null);
  let framesError = $state(false);
  let hlsInstance: { destroy: () => void } | null = null;

  // Quality / level state (HLS only)
  interface Level {
    index: number;
    label: string;
  }
  let levels = $state<Level[]>([]);
  let currentLevel = $state(-1); // -1 = auto

  const hoverFrame = $derived.by(() => {
    if (!frames || hoverX === null || !wrapperEl || duration <= 0) return null;
    const bounds = wrapperEl.getBoundingClientRect();
    if (bounds.width === 0) return null;
    const ratio = Math.max(0, Math.min(1, (hoverX - bounds.left) / bounds.width));
    const targetTime = ratio * duration;
    const idx = frames.findIndex((f) => targetTime >= f.start && targetTime < f.end);
    return frames[idx >= 0 ? idx : frames.length - 1] ?? null;
  });

  const spriteDims = $derived.by(() => {
    if (!frames) return { spriteWidth: 0, spriteHeight: 0 };
    return {
      spriteWidth: frames.reduce((m, f) => Math.max(m, f.x + f.width), 0),
      spriteHeight: frames.reduce((m, f) => Math.max(m, f.y + f.height), 0),
    };
  });

  onMount(() => {
    if (!videoEl) return;

    const attachHls = async () => {
      if (!src) return;
      if (videoEl!.canPlayType("application/vnd.apple.mpegurl")) {
        // Safari handles HLS natively.
        videoEl!.src = src;
        return;
      }
      const { default: Hls } = await import("hls.js");
      if (Hls.isSupported()) {
        const hls = new Hls({ autoStartLoad: true });
        hlsInstance = hls;
        hls.loadSource(src);
        hls.attachMedia(videoEl!);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          levels = hls.levels.map((lvl, i) => ({
            index: i,
            label: lvl.height ? `${lvl.height}p` : `${Math.round((lvl.bitrate ?? 0) / 1000)} kbps`,
          }));
        });
        hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
          currentLevel = data.level;
        });
      }
    };

    if (src && !directSrc) {
      void attachHls();
    } else if (directSrc) {
      videoEl!.src = directSrc;
    }

    const onLoaded = () => {
      duration = videoEl!.duration || 0;
    };
    const onTime = () => {
      currentTime = videoEl!.currentTime;
    };
    const onPause = () => {
      paused = videoEl!.paused;
    };
    const onVolume = () => {
      muted = videoEl!.muted;
      volume = videoEl!.volume;
    };
    videoEl.addEventListener("loadedmetadata", onLoaded);
    videoEl.addEventListener("timeupdate", onTime);
    videoEl.addEventListener("play", onPause);
    videoEl.addEventListener("pause", onPause);
    videoEl.addEventListener("volumechange", onVolume);

    if (trickplayVtt) {
      loadTrickplayFrames(trickplayVtt)
        .then((f) => (frames = f))
        .catch(() => (framesError = true));
    }

    return () => {
      videoEl?.removeEventListener("loadedmetadata", onLoaded);
      videoEl?.removeEventListener("timeupdate", onTime);
      videoEl?.removeEventListener("play", onPause);
      videoEl?.removeEventListener("pause", onPause);
      videoEl?.removeEventListener("volumechange", onVolume);
      hlsInstance?.destroy();
      hlsInstance = null;
    };
  });

  function togglePlay() {
    if (!videoEl) return;
    if (videoEl.paused) void videoEl.play();
    else videoEl.pause();
  }

  function toggleMute() {
    if (!videoEl) return;
    videoEl.muted = !videoEl.muted;
  }

  function onSeekbar(e: MouseEvent) {
    if (!videoEl || duration <= 0 || !wrapperEl) return;
    const bounds = wrapperEl.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - bounds.left) / bounds.width));
    videoEl.currentTime = ratio * duration;
  }

  function onSeekbarHover(e: MouseEvent) {
    hoverX = e.clientX;
  }

  function onSeekbarLeave() {
    hoverX = null;
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      wrapperEl?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }

  function fmt(time: number) {
    const s = Math.floor(time);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) {
      return `${h}:${String(m % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    }
    return `${m}:${String(s % 60).padStart(2, "0")}`;
  }

  function setQuality(idx: number) {
    // Hls.js maintains its own level index on the instance; we reach in via the imported class.
    import("hls.js").then(({ default: Hls }) => {
      if (hlsInstance && Hls.isSupported()) {
        (hlsInstance as unknown as { currentLevel: number }).currentLevel = idx;
      }
    });
  }

  const progressPct = $derived(duration > 0 ? (currentTime / duration) * 100 : 0);
  const hoverPct = $derived(
    hoverX !== null && wrapperEl
      ? Math.max(
          0,
          Math.min(
            100,
            ((hoverX - wrapperEl.getBoundingClientRect().left) /
              wrapperEl.getBoundingClientRect().width) *
              100,
          ),
        )
      : 0,
  );
</script>

<div
  bind:this={wrapperEl}
  class={`relative aspect-video bg-black overflow-hidden group ${className ?? ""}`}
>
  <video
    bind:this={videoEl}
    {poster}
    class="h-full w-full"
    {autoplay}
    controlsList="nodownload"
    playsinline
    crossorigin="anonymous"
  >
    {#each subtitles as sub, i (sub.id)}
      <track
        kind="subtitles"
        srclang={sub.language ?? undefined}
        label={sub.label}
        src={sub.src}
        default={i === 0}
      />
    {/each}
  </video>

  <!-- Control overlay -->
  <div class="absolute inset-0 pointer-events-none flex flex-col justify-between">
    <div></div>
    <div class="pointer-events-auto bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 space-y-2 opacity-0 group-hover:opacity-100 transition-opacity duration-fast">
      <!-- Seekbar -->
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div
        class="relative h-2 bg-white/10 cursor-pointer"
        onclick={onSeekbar}
        onmousemove={onSeekbarHover}
        onmouseleave={onSeekbarLeave}
        role="slider"
        aria-valuenow={Math.round(currentTime)}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        tabindex="0"
      >
        <div
          class="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-accent-700 via-accent-500 to-accent-300"
          style:width="{progressPct}%"
        ></div>
        {#if hoverX !== null && hoverFrame && trickplaySprite && spriteDims.spriteWidth > 0}
          <div
            class="absolute -top-2 -translate-y-full pointer-events-none surface-panel overflow-hidden"
            style:left="{hoverPct}%"
            style:transform="translate(-50%, -100%)"
            style:width="{hoverFrame.width}px"
            style:height="{hoverFrame.height}px"
          >
            <div
              class="w-full h-full"
              style:background-image="url({trickplaySprite})"
              style:background-size="{(spriteDims.spriteWidth / hoverFrame.width) * 100}% {(spriteDims.spriteHeight / hoverFrame.height) * 100}%"
              style:background-position="{spriteDims.spriteWidth <= hoverFrame.width
                ? 0
                : (hoverFrame.x / (spriteDims.spriteWidth - hoverFrame.width)) * 100}% {spriteDims.spriteHeight <= hoverFrame.height
                ? 0
                : (hoverFrame.y / (spriteDims.spriteHeight - hoverFrame.height)) * 100}%"
            ></div>
          </div>
        {/if}
      </div>

      <div class="flex items-center gap-2 text-body-sm text-white">
        <button
          type="button"
          onclick={togglePlay}
          class="px-2 py-1 hover:bg-white/10 transition-colors duration-fast"
          aria-label={paused ? "Play" : "Pause"}
        >
          {paused ? "▶" : "⏸"}
        </button>

        <span class="font-mono text-[0.7rem] text-white/80 tabular-nums">
          {fmt(currentTime)} / {fmt(duration)}
        </span>

        <button
          type="button"
          onclick={toggleMute}
          class="ml-auto px-2 py-1 hover:bg-white/10 transition-colors duration-fast"
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted || volume === 0 ? "🔇" : "🔊"}
        </button>

        {#if levels.length > 1}
          <select
            value={currentLevel}
            onchange={(e) => setQuality(Number(e.currentTarget.value))}
            class="bg-black/60 border border-white/20 px-1.5 py-0.5 text-[0.7rem] text-white"
            aria-label="Quality"
          >
            <option value={-1}>Auto</option>
            {#each levels as lvl (lvl.index)}
              <option value={lvl.index}>{lvl.label}</option>
            {/each}
          </select>
        {/if}

        <button
          type="button"
          onclick={toggleFullscreen}
          class="px-2 py-1 hover:bg-white/10 transition-colors duration-fast"
          aria-label="Fullscreen"
        >
          ⛶
        </button>
      </div>
    </div>
  </div>
</div>
