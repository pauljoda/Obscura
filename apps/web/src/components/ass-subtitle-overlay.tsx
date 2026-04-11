"use client";

import { useEffect, useRef } from "react";
import { fetchSceneSubtitleSource } from "../lib/api/media";

interface AssSubtitleOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  sceneId: string;
  trackId: string;
  /** 0..1. We fade JASSUB's canvas so it matches the surrounding UI. */
  opacity?: number;
}

/**
 * Renders an ASS/SSA subtitle track over a <video> element with full libass
 * fidelity — fonts, positioning, colors, gradients, karaoke timing, and the
 * `\move`/`\fad`/`\t` animation families all work because libass itself is
 * running in a worker (via JASSUB's WebAssembly build).
 *
 * The canvas JASSUB creates is inserted as a sibling of the <video> element
 * by JASSUB itself; we just feed it the parsed cue data and tear it down on
 * unmount. We intentionally do NOT mirror the cue text in the plain-text
 * caption overlay — the transcript panel still receives text via the existing
 * `onActiveCueChange` pipeline in video-player.tsx.
 */
export function AssSubtitleOverlay({
  videoRef,
  sceneId,
  trackId,
  opacity = 1,
}: AssSubtitleOverlayProps) {
  const instanceRef = useRef<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    let instance: { destroy?: () => Promise<void> | void } | null = null;

    async function boot() {
      const video = videoRef.current;
      if (!video) return;

      let subContent: string;
      try {
        subContent = await fetchSceneSubtitleSource(sceneId, trackId);
      } catch (err) {
        console.warn("[ass-overlay] failed to fetch subtitle source", err);
        return;
      }
      if (cancelled) return;

      // JASSUB is a hefty WASM module — load it lazily so it doesn't ship
      // in the initial chunk for users who never play an ASS-subtitled video.
      const { default: JASSUB } = await import("jassub");
      if (cancelled) return;

      try {
        // eslint-disable-next-line new-cap
        instance = new JASSUB({
          video,
          subContent,
          workerUrl: "/jassub/jassub-worker.js",
          wasmUrl: "/jassub/jassub-worker.wasm",
          modernWasmUrl: "/jassub/jassub-worker-modern.wasm",
          // Ask the browser to use any locally-installed fonts that match the
          // names referenced by the ASS styles. Falls back to default.woff2.
          availableFonts: { "liberation sans": "/jassub/default.woff2" },
          fallbackFont: "liberation sans",
          queryFonts: "local",
        } as never);
        instanceRef.current = instance;
      } catch (err) {
        console.warn("[ass-overlay] JASSUB init failed", err);
      }
    }

    void boot();

    return () => {
      cancelled = true;
      const current = instance ?? (instanceRef.current as typeof instance);
      if (current && typeof current.destroy === "function") {
        try {
          void current.destroy();
        } catch {
          // ignore
        }
      }
      instanceRef.current = null;
    };
  }, [sceneId, trackId, videoRef]);

  // JASSUB mounts its own canvas in the DOM — we only need to propagate
  // opacity. It tags its wrapper with `.JASSUB`, so one targeted selector
  // inside the parent is enough.
  useEffect(() => {
    const video = videoRef.current;
    const parent = video?.parentElement;
    if (!parent) return;
    const wrapper = parent.querySelector<HTMLElement>(".JASSUB");
    if (wrapper) wrapper.style.opacity = String(opacity);
  }, [opacity, videoRef]);

  return null;
}
