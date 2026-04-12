import type { PreviewCandidate } from "./types";

export function buildPreviewPathMap(
  candidates: PreviewCandidate[],
  limit = 4,
): Map<string, string[]> {
  const grouped = new Map<string, PreviewCandidate[]>();

  for (const candidate of candidates) {
    if (!candidate.previewPath) continue;
    const existing = grouped.get(candidate.containerId);
    if (existing) {
      existing.push(candidate);
    } else {
      grouped.set(candidate.containerId, [candidate]);
    }
  }

  const previewMap = new Map<string, string[]>();
  for (const [containerId, rows] of grouped) {
    const previewPaths = rows
      .sort((a, b) => {
        const depthDiff = a.depth - b.depth;
        if (depthDiff !== 0) return depthDiff;
        return a.filePath.localeCompare(b.filePath);
      })
      .slice(0, limit)
      .map((row) => row.previewPath!)
      .filter((value, index, self) => self.indexOf(value) === index);

    previewMap.set(containerId, previewPaths);
  }

  return previewMap;
}
