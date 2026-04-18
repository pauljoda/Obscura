<script lang="ts">
  import { onMount } from "svelte";
  import { fetchVideoSubtitleSource } from "$lib/api/videos";

  interface Props {
    videoEl: HTMLVideoElement | null | undefined;
    videoId: string;
    trackId: string;
    opacity?: number;
  }

  let { videoEl, videoId, trackId, opacity = 1 }: Props = $props();

  let instance: { destroy?: () => Promise<void> | void } | null = null;

  onMount(() => {
    let cancelled = false;

    async function boot() {
      if (!videoEl) return;

      let subContent: string;
      try {
        subContent = await fetchVideoSubtitleSource(videoId, trackId);
      } catch (err) {
        console.warn("[ass-overlay] failed to fetch subtitle source", err);
        return;
      }
      if (cancelled) return;

      // Lazy-import at runtime only — Vite cannot statically analyze
      // jassub's IIFE worker, so we use a string indirection + the
      // @vite-ignore hint so it's left alone at build time.
      const mod = "jassub";
      const { default: JASSUB } = await import(/* @vite-ignore */ mod);
      if (cancelled || !videoEl) return;

      try {
        instance = new (JASSUB as unknown as new (opts: Record<string, unknown>) => {
          destroy?: () => Promise<void> | void;
        })({
          video: videoEl,
          subContent,
          workerUrl: "/jassub/jassub-worker.js",
          wasmUrl: "/jassub/jassub-worker.wasm",
          modernWasmUrl: "/jassub/jassub-worker-modern.wasm",
          availableFonts: { "liberation sans": "/jassub/default.woff2" },
          defaultFont: "liberation sans",
          queryFonts: "local",
        });
      } catch (err) {
        console.warn("[ass-overlay] JASSUB init failed", err);
      }
    }

    void boot();

    return () => {
      cancelled = true;
      if (instance && typeof instance.destroy === "function") {
        try {
          void instance.destroy();
        } catch {
          // ignore
        }
      }
      instance = null;
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
