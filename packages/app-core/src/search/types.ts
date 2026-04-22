import type { EntityKind, SearchResultItem } from "@obscura/contracts";
import type { AppDb } from "@obscura/db";

export interface SearchProviderQuery {
  q: string;
  limit: number;
  offset: number;
  filters: {
    rating?: number;
    dateFrom?: string;
    dateTo?: string;
    tags?: string[];
    /** "off" = exclude NSFW content, "blur"/"show" = include all */
    nsfw?: string;
  };
}

export interface SearchProviderResult {
  items: SearchResultItem[];
  total: number;
}

export interface SearchProvider {
  kind: EntityKind;
  label: string;
  defaultPreviewLimit: number;
  query(params: SearchProviderQuery): Promise<SearchProviderResult>;
}

export type SearchProviderFactory = (db: AppDb) => SearchProvider;
