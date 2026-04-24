export type QualityMode = "auto" | "direct" | number | `seed:${string}`;
export type VideoPlaybackMode = "direct" | "hls";

export interface VideoLoadStateInput {
  src?: string;
  directSrc?: string;
  defaultPlaybackMode?: VideoPlaybackMode;
  requestedMode: VideoPlaybackMode;
  prevSrcKey: string;
}

export interface VideoLoadState {
  srcKey: string;
  isNewSource: boolean;
  effectiveMode: VideoPlaybackMode;
  loadKey: string;
}

export function requestedModeFromQualityMode(
  qualityMode: QualityMode,
): VideoPlaybackMode {
  return qualityMode === "direct" ? "direct" : "hls";
}

export function chooseInitialPlaybackMode({
  src,
  directSrc,
  defaultPlaybackMode,
}: {
  src?: string;
  directSrc?: string;
  defaultPlaybackMode?: VideoPlaybackMode;
}): VideoPlaybackMode {
  if (defaultPlaybackMode === "hls" && src) {
    return "hls";
  }

  if (directSrc) {
    return "direct";
  }

  return "hls";
}
export function computeVideoLoadState({
  src,
  directSrc,
  defaultPlaybackMode,
  requestedMode,
  prevSrcKey,
}: VideoLoadStateInput): VideoLoadState {
  const srcKey = `${src ?? ""}|${directSrc ?? ""}`;
  const isNewSource = srcKey !== prevSrcKey;
  const initialMode = chooseInitialPlaybackMode({
    src,
    directSrc,
    defaultPlaybackMode,
  });
  const effectiveMode = isNewSource ? initialMode : requestedMode;

  return {
    srcKey,
    isNewSource,
    effectiveMode,
    loadKey: `${srcKey}|${effectiveMode}`,
  };
}
