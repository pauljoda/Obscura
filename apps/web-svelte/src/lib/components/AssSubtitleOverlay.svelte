<script lang="ts">
  import { fetchVideoSubtitleSource } from "$lib/v1/api/videos-v1";
  import { loadJassub } from "$lib/vendor/load-jassub";

  interface Props {
    videoEl: HTMLVideoElement | null | undefined;
    videoId: string;
    trackId: string;
    opacity?: number;
  }

  let { videoEl, videoId, trackId, opacity = 1 }: Props = $props();

  let instance: { destroy?: () => Promise<void> | void } | null = null;

  $effect(() => {
    const video = videoEl;
    const currentVideoId = videoId;
    const currentTrackId = trackId;
    if (!video) return;

    let cancelled = false;
    let localInstance: { destroy?: () => Promise<void> | void } | null = null;

    async function boot() {
      try {
        const subContent = await fetchVideoSubtitleSource(currentVideoId, currentTrackId);
        if (cancelled) return;
        const JASSUB = await loadJassub();
        if (cancelled) return;
        localInstance = new JASSUB({
          video,
          subContent,
          workerUrl: "/jassub/jassub-worker.js",
          wasmUrl: "/jassub/jassub-worker.wasm",
          modernWasmUrl: "/jassub/jassub-worker-modern.wasm",
          availableFonts: { "liberation sans": "/jassub/default.woff2" },
          defaultFont: "liberation sans",
          queryFonts: "local",
        });
        instance = localInstance;
      } catch (err) {
        console.warn("[ass-overlay] failed to boot", err);
      }
    }

    void boot();

    return () => {
      cancelled = true;
      if (localInstance && typeof localInstance.destroy === "function") {
        try {
          void localInstance.destroy();
        } catch {
          // ignore
        }
      }
      if (instance === localInstance) instance = null;
    };
  });

  $effect(() => {
    if (!videoEl) return;
    const parent = videoEl.parentElement;
    if (!parent) return;
    const wrapper = parent.querySelector<HTMLElement>(".JASSUB");
    if (wrapper) wrapper.style.opacity = String(opacity);
  });
</script>
