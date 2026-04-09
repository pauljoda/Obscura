import type { ScenesListPrefsActiveFilter } from "./scenes-list-prefs";
import type { SortDir, SortOption } from "./scene-browse-types";

export interface FilterPreset {
  id: string;
  name: string;
  filters: ScenesListPrefsActiveFilter[];
  sortBy: SortOption;
  sortDir: SortDir;
}

const STORAGE_KEY = "obscura-scenes-filter-presets";
const MAX_PRESETS = 20;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validatePreset(raw: unknown): FilterPreset | null {
  if (!isRecord(raw)) return null;
  const { id, name, filters, sortBy, sortDir } = raw;
  if (typeof id !== "string" || typeof name !== "string") return null;
  if (typeof sortBy !== "string" || typeof sortDir !== "string") return null;
  if (sortDir !== "asc" && sortDir !== "desc") return null;
  if (!Array.isArray(filters)) return null;
  for (const f of filters) {
    if (!isRecord(f)) return null;
    if (typeof f.label !== "string" || typeof f.type !== "string" || typeof f.value !== "string")
      return null;
  }
  return {
    id,
    name: name.slice(0, 100),
    filters: filters as ScenesListPrefsActiveFilter[],
    sortBy: sortBy as SortOption,
    sortDir,
  };
}

export function loadPresets(): FilterPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const presets: FilterPreset[] = [];
    for (const item of parsed) {
      const preset = validatePreset(item);
      if (preset) presets.push(preset);
      if (presets.length >= MAX_PRESETS) break;
    }
    return presets;
  } catch {
    return [];
  }
}

export function savePresets(presets: FilterPreset[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets.slice(0, MAX_PRESETS)));
  } catch {
    // localStorage full or unavailable
  }
}
