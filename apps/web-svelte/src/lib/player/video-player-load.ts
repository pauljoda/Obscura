export type QualityMode = "auto" | "direct" | number | `seed:${string}`;
export type VideoPlaybackMode = "direct" | "hls";

type CanPlayType = (mime: string) => CanPlayTypeResult | string;

export interface VideoLoadStateInput {
  src?: string;
  directSrc?: string;
  defaultPlaybackMode?: VideoPlaybackMode;
  directPlayable?: boolean;
  requestedMode: VideoPlaybackMode;
  prevSrcKey: string;
}

export interface VideoLoadState {
  srcKey: string;
  isNewSource: boolean;
  effectiveMode: VideoPlaybackMode;
  loadKey: string;
}

export interface AdaptiveAutoLevelSelection {
  currentLevel: -1;
  startLevel: -1;
  nextAutoLevel: -1;
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
  directPlayable = true,
}: {
  src?: string;
  directSrc?: string;
  defaultPlaybackMode?: VideoPlaybackMode;
  directPlayable?: boolean;
}): VideoPlaybackMode {
  if (defaultPlaybackMode === "hls" && src) {
    return "hls";
  }

  if (directSrc && directPlayable) {
    return "direct";
  }

  return "hls";
}

function normalizeCodec(codec: string | null | undefined): string {
  return codec?.trim().toLowerCase() ?? "";
}

export function isHevcCodec(codec: string | null | undefined): boolean {
  const normalized = normalizeCodec(codec);
  return normalized === "hevc" || normalized === "h265" || normalized === "h.265";
}

function supportsAnyMime(canPlayType: CanPlayType, candidates: readonly string[]): boolean {
  return candidates.some((mime) => {
    const result = canPlayType(mime);
    return result === "probably" || result === "maybe";
  });
}

export function canUseDirectPlayback({
  directSrc,
  codec,
  canPlayType,
}: {
  directSrc?: string;
  codec?: string | null;
  canPlayType?: CanPlayType;
}): boolean {
  if (!directSrc) return false;
  if (!isHevcCodec(codec)) return true;
  if (!canPlayType) return false;

  return supportsAnyMime(canPlayType, [
    'video/mp4; codecs="hvc1"',
    'video/mp4; codecs="hev1"',
    'video/mp4; codecs="hvc1, mp4a.40.2"',
    'video/mp4; codecs="hev1, mp4a.40.2"',
  ]);
}

export function computeVideoLoadState({
  src,
  directSrc,
  defaultPlaybackMode,
  directPlayable = true,
  requestedMode,
  prevSrcKey,
}: VideoLoadStateInput): VideoLoadState {
  const srcKey = `${src ?? ""}|${directSrc ?? ""}`;
  const isNewSource = srcKey !== prevSrcKey;
  const initialMode = chooseInitialPlaybackMode({
    src,
    directSrc,
    defaultPlaybackMode,
    directPlayable,
  });
  const effectiveMode = isNewSource ? initialMode : requestedMode;

  return {
    srcKey,
    isNewSource,
    effectiveMode,
    loadKey: `${srcKey}|${effectiveMode}`,
  };
}

export function adaptiveAutoLevelSelection(): AdaptiveAutoLevelSelection {
  return {
    currentLevel: -1,
    startLevel: -1,
    nextAutoLevel: -1,
  };
}
