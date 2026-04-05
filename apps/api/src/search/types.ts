import type { EntityKind, SearchResultItem } from "@obscura/contracts";

export interface SearchProviderQuery {
  q: string;
  limit: number;
  offset: number;
  filters: {
    rating?: number;
    dateFrom?: string;
    dateTo?: string;
    tags?: string[];
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
