export interface TrickplayFrame {
  start: number;
  end: number;
  x: number;
  y: number;
  width: number;
  height: number;
  url: string;
}

const trickplayCache = new Map<string, Promise<TrickplayFrame[]>>();

function parseTimestamp(value: string) {
  const [timePart, msPart = "0"] = value.trim().split(".");
  const segments = timePart.split(":").map(Number);
  if (segments.length !== 3 || segments.some((segment) => Number.isNaN(segment))) {
    return 0;
  }

  const [hours, minutes, seconds] = segments;
  return hours * 3600 + minutes * 60 + seconds + Number(msPart) / 1000;
}

export function parseTrickplayVtt(raw: string): TrickplayFrame[] {
  const frames: TrickplayFrame[] = [];
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = 0; index < lines.length - 1; index += 1) {
    const line = lines[index];
    if (!line.includes("-->")) {
      continue;
    }

    const [startRaw, endRaw] = line.split("-->").map((part) => part.trim());
    const assetLine = lines[index + 1];
    const [url, fragment] = assetLine.split("#xywh=");
    if (!fragment) {
      continue;
    }

    const [x, y, width, height] = fragment.split(",").map(Number);
    if ([x, y, width, height].some((value) => Number.isNaN(value))) {
      continue;
    }

    frames.push({
      start: parseTimestamp(startRaw),
      end: parseTimestamp(endRaw),
      x,
      y,
      width,
      height,
      url,
    });
  }

  return frames;
}

export async function loadTrickplayFrames(vttUrl: string): Promise<TrickplayFrame[]> {
  const cached = trickplayCache.get(vttUrl);
  if (cached) {
    return cached;
  }

  const pending = fetch(vttUrl)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load trickplay map (${response.status})`);
      }
      return response.text();
    })
    .then(parseTrickplayVtt);

  trickplayCache.set(vttUrl, pending);
  return pending;
}

export function findFrameAtTime(frames: TrickplayFrame[], time: number): number {
  const index = frames.findIndex((frame) => time >= frame.start && time < frame.end);
  if (index !== -1) return index;
  // Fallback: clamp to last frame
  return Math.max(0, frames.length - 1);
}
