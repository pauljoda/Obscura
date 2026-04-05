/**
 * Cross-browser fullscreen helpers. Mobile Safari often ignores
 * `Element.requestFullscreen()` on wrapper divs; iOS uses
 * `HTMLVideoElement.webkitEnterFullscreen()` instead.
 */

type FullscreenElement = Element & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  mozRequestFullScreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

type VideoWithWebKit = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
};

function requestFullscreenOn(el: Element): Promise<void> {
  const anyEl = el as FullscreenElement;
  const result =
    el.requestFullscreen?.() ??
    (anyEl.webkitRequestFullscreen
      ? Promise.resolve(anyEl.webkitRequestFullscreen())
      : undefined) ??
    (anyEl.mozRequestFullScreen
      ? Promise.resolve(anyEl.mozRequestFullScreen())
      : undefined) ??
    (anyEl.msRequestFullscreen
      ? Promise.resolve(anyEl.msRequestFullscreen())
      : undefined);

  return result ?? Promise.reject(new Error("Fullscreen API not available"));
}

export function isDocumentFullscreen(): boolean {
  const doc = document as Document & { webkitFullscreenElement?: Element | null };
  return Boolean(document.fullscreenElement ?? doc.webkitFullscreenElement);
}

export function exitDocumentFullscreen(): void {
  const doc = document as Document & {
    webkitExitFullscreen?: () => Promise<void> | void;
    msExitFullscreen?: () => Promise<void> | void;
  };
  void (
    document.exitFullscreen?.() ??
    doc.webkitExitFullscreen?.() ??
    doc.msExitFullscreen?.()
  );
}

/**
 * Enter fullscreen: try the container (keeps custom controls on desktop),
 * then the video element, then WebKit native video fullscreen (iOS).
 */
export function enterMediaFullscreen(container: Element, video: HTMLVideoElement | null): void {
  const videoWebKit = video as VideoWithWebKit | null;

  void requestFullscreenOn(container)
    .catch(() => (video ? requestFullscreenOn(video) : Promise.reject(new Error("no video"))))
    .catch(() => {
      try {
        videoWebKit?.webkitEnterFullscreen?.();
      } catch {
        /* noop — e.g. no loaded media */
      }
    });
}
