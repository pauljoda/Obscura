// ─── Shared Query & Response Types ──────────────────────────────
// Canonical types for list queries, pagination, and error responses
// used across the API, web frontend, and worker.

// ─── Pagination ─────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// ─── Error ──────────────────────────────────────────────────────

export interface ErrorResponse {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

// ─── Base List Query ────────────────────────────────────────────

export interface ListQuery {
  search?: string;
  sort?: string;
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
  nsfw?: "on" | "off";
}

// ─── Entity List Queries ────────────────────────────────────────

export interface SceneListQuery extends ListQuery {
  tag?: string | string[];
  performer?: string | string[];
  studio?: string | string[];
  resolution?: string | string[];
  codec?: string | string[];
  ratingMin?: number;
  ratingMax?: number;
  dateFrom?: string;
  dateTo?: string;
  durationMin?: number;
  durationMax?: number;
  organized?: boolean;
  interactive?: boolean;
  hasFile?: boolean;
  played?: boolean;
}

export interface GalleryListQuery extends ListQuery {
  tag?: string | string[];
  performer?: string | string[];
  studio?: string;
  type?: string;
  parent?: string;
  root?: string;
  ratingMin?: number;
  ratingMax?: number;
  dateFrom?: string;
  dateTo?: string;
  imageCountMin?: number;
  organized?: boolean;
}

export interface PerformerListQuery extends ListQuery {
  gender?: string;
  favorite?: boolean;
  country?: string;
  ratingMin?: number;
  ratingMax?: number;
  hasImage?: boolean;
  sceneCountMin?: number;
}

export interface ImageListQuery extends ListQuery {
  gallery?: string;
  tag?: string | string[];
  performer?: string | string[];
  studio?: string;
  ratingMin?: number;
  ratingMax?: number;
  dateFrom?: string;
  dateTo?: string;
  resolution?: string;
  organized?: boolean;
}

export interface StudioListQuery extends ListQuery {
  favorite?: boolean;
  ratingMin?: number;
  ratingMax?: number;
  sceneCountMin?: number;
  hasImage?: boolean;
}

export interface TagListQuery extends ListQuery {
  letter?: string;
  sceneCountMin?: number;
}

// ─── Bulk Operations ────────────────────────────────────────────

export interface BulkUpdateResult {
  updated: number;
  ids: string[];
}
