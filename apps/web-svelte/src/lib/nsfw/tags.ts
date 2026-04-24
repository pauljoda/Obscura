import type { NsfwMode } from "./cookie";

/**
 * In SFW (off) mode, NSFW-tagged rows are omitted from chip rows so only
 * safe tags show real names. Blur/show modes keep the full list
 * (NsfwTagLabel obscures per mode).
 */
export function tagsVisibleInNsfwMode<T extends { isNsfw?: boolean }>(
  tags: T[] | undefined,
  mode: NsfwMode,
): T[] {
  if (!tags?.length) return [];
  if (mode !== "off") return tags;
  return tags.filter((t) => t.isNsfw !== true);
}

const TAG_GARBLE_CHARS = ["▒", "░", "█"] as const;

export function garbleTagLabelText(text: string): string {
  return [...text]
    .map((ch, i) => (/\s/.test(ch) ? ch : TAG_GARBLE_CHARS[i % TAG_GARBLE_CHARS.length]!))
    .join("");
}
