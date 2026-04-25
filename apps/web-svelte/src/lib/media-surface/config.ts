/**
 * Public types for the MediaSurface package.
 *
 * A MediaSurface is one drop-in component that renders a paginated
 * thumbnail grid plus its toolbar (search, sort, filters, presets, view
 * mode, thumb size) plus its infinite-scroll trigger. A page provides a
 * MediaSurfaceConfig and gets the whole stack — including DB-backed
 * persisted preferences keyed off the page-supplied surfaceId.
 *
 * This file is deliberately type-only: no Svelte imports, no runtime,
 * no dependency on the rest of the package. Sub-components import from
 * here so the type graph stays one-way.
 */

import type { Component, Snippet } from "svelte";

/** Svelte 5 component or legacy Svelte 4 ComponentType — accepts both. */
type AnyComponent = Component<any, any, any>;

// ── Sort / view ───────────────────────────────────────────────────────

export type SortDir = "asc" | "desc";

export interface SortOption<T extends string = string> {
  value: T;
  label: string;
}

export interface ViewModeSpec {
  mode: string;
  icon: AnyComponent;
  label: string;
}

// ── Filters ───────────────────────────────────────────────────────────

export interface ActiveFilter<F extends string = string> {
  type: F;
  label: string;
  value: string;
}

/**
 * Declarative description of a built-in filter section. The
 * FilterDrawer renders one section per spec, using the `kind` to pick
 * the right sub-component:
 *   - enum: fixed list of options (resolution, codec, played, etc.)
 *   - range: numeric range (rating, image-count, duration-min/max)
 *   - date-range: from/to date pickers
 *   - rating: star rating (specialized range)
 *   - alphabetical-id-list: id-keyed picker (tags, performers, studios)
 *
 * Each section can supply a custom `encode` to translate its
 * activeFilter entries into API query params; the default encoder
 * handles the common shapes.
 */
export type FilterSectionKind =
  | "enum"
  | "range"
  | "date-range"
  | "rating"
  | "alphabetical-id-list";

export interface FilterSectionSpec<F extends string = string> {
  kind: FilterSectionKind;
  filterType: F;
  label: string;
  /** Options for kind="enum". Each value is what's stored in ActiveFilter.value. */
  options?: Array<{ value: string; label: string }>;
  /** Source key for kind="alphabetical-id-list" (e.g. "tags", "performers", "studios"). */
  source?: "tags" | "performers" | "studios";
  /** For range/date-range, the names of the two filter types that bracket the range. */
  rangeTypes?: { min: F; max: F };
  /**
   * Custom encoder that writes this filter's value into the API query
   * params object. If omitted, the codec falls back to a built-in
   * encoder per `kind`.
   */
  encode?: (
    value: string | string[],
    params: Record<string, unknown>,
  ) => void;
  /**
   * Custom display formatter for the chip. If omitted, the chip shows
   * the raw value.
   */
  formatValue?: (value: string) => string;
}

/**
 * The handful of filter types whose value is exclusive — selecting a
 * second value of the same type replaces the first instead of toggling
 * a multi-select.
 */
export type ExclusiveFilterTypes<F extends string> = ReadonlySet<F>;

// ── Persisted preferences ─────────────────────────────────────────────

export interface SurfacePrefs<F extends string = string> {
  viewMode: string;
  sortBy: string;
  sortDir: SortDir;
  search: string;
  activeFilters: ActiveFilter<F>[];
  activePresetId?: string;
  /** Thumbnail-size column count, when thumbSize is configured. */
  cols?: number;
  /** Per-surface extension slot for one-off knobs that don't fit elsewhere. */
  extras?: Record<string, string | number | boolean | null>;
}

export interface ThumbSizeConfig {
  min: number;
  max: number;
  default: number;
  /** Optional label override; defaults to "Card size". */
  label?: string;
}

// ── Bulk actions ──────────────────────────────────────────────────────

export interface BulkActionSpec<T> {
  id: string;
  label: string;
  icon?: AnyComponent;
  variant?: "default" | "danger";
  /** Called with the selected items. Surface clears selection after resolve. */
  handler: (selected: T[]) => Promise<void> | void;
  /** When set, surface shows a confirmation dialog before invoking handler. */
  confirm?: { title: string; message: string; confirmLabel?: string };
}

// ── Fetcher ───────────────────────────────────────────────────────────

export interface FetchPageArgs<F extends string = string> {
  offset: number;
  limit: number;
  signal: AbortSignal;
  prefs: SurfacePrefs<F>;
}

export interface FetchPageResult<T> {
  items: T[];
  total: number;
}

export type Fetcher<T, F extends string = string> = (
  args: FetchPageArgs<F>,
) => Promise<FetchPageResult<T>>;

// ── Body layouts ──────────────────────────────────────────────────────

export type BodyLayout = "grid" | "list" | "feed" | "masonry";

// ── Card render contract ──────────────────────────────────────────────

export interface CardProps<T> {
  item: T;
  index: number;
  imageLoading: "eager" | "lazy";
  /** Selection state, when the surface has bulkActions configured. */
  selected?: boolean;
  /** Toggle selection; only present when bulkActions are configured. */
  onToggleSelect?: () => void;
  /** The body layout currently rendering this card; cards that render
   *  differently in list vs grid (e.g. a row vs a tile) read this. */
  layout?: BodyLayout;
}

// ── Top-level config ──────────────────────────────────────────────────

export interface AvailableFilterItem {
  id: string;
  name: string;
  count?: number;
  isNsfw?: boolean;
}

export interface AvailableFilterItems {
  tags?: AvailableFilterItem[];
  performers?: AvailableFilterItem[];
  studios?: AvailableFilterItem[];
}

export interface MediaSurfaceConfig<T extends { id: string }, F extends string = string> {
  // Identity
  /**
   * Stable surface id. Used to key persisted prefs and presets in
   * `ui_prefs` under `surface:${surfaceId}:prefs` / `:presets`. Must be
   * unique across the app — top-level routes use the route name
   * (`videos`, `images`), detail tabs use `${entity}:${id}:${tab}`.
   */
  surfaceId: string;

  // Data
  pageSize: number;
  fetcher: Fetcher<T, F>;
  /** First-page SSR hydrate. Pass loadedStart for deep-link `?page=N`. */
  initial?: { items: T[]; total: number; loadedStart: number };

  // Rendering
  card: Component<CardProps<T>>;
  bodyLayout?: BodyLayout;
  /** Map view-mode value to body layout; takes precedence over bodyLayout. */
  layoutByViewMode?: Record<string, BodyLayout>;
  getKey?: (item: T) => string;

  // Toolbar
  defaultPrefs: SurfacePrefs<F>;
  sortOptions: SortOption[];
  /** Per-sort-key default direction applied when switching to that key. */
  defaultSortDir?: Record<string, SortDir>;
  viewModes?: ViewModeSpec[];
  filterSections?: FilterSectionSpec<F>[];
  /**
   * Available items for alphabetical-id-list filter sections (tags,
   * performers, studios). Pages typically resolve these from server
   * load and reflect them here.
   */
  availableFilterItems?: AvailableFilterItems;
  /** Filter types whose value replaces the previous selection rather than toggling. */
  exclusiveFilterTypes?: ExclusiveFilterTypes<F>;
  searchPlaceholder?: string;
  thumbSize?: ThumbSizeConfig;

  // Bulk
  bulkActions?: BulkActionSpec<T>[];
  /** Plural noun shown in the BulkActionBar's "Select N {label}" prompt. */
  bulkItemLabel?: string;

  // Page-side extension points
  /** Extra controls rendered at the right edge of the toolbar (e.g. Import / Upload). */
  toolbarExtras?: Snippet<[{ prefs: SurfacePrefs<F> }]>;
  /** Extra rows rendered at the top of the filter drawer for per-route filters
   *  that don't map to a built-in section kind (dynamic lists, compound toggles). */
  extraFilterSections?: Snippet<[{
    panelFilters: Array<{ type?: string; label: string; value: string }>;
    onAddFilter: (type: F, label: string, value: string) => void;
  }]>;
  /** Renders when items.length === 0 and loading === false. */
  emptyState?: Snippet<[{ prefs: SurfacePrefs<F> }]>;

  /** Called when the user activates a card (click without modifier keys). */
  onItemActivate?: (item: T, index: number) => void;
}
