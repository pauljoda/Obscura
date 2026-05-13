/**
 * Shared types for the built-in filter-section components. Each section
 * receives the current `panelFilters` (so it can mark its own choices
 * as active) and an `onAddFilter` callback that adds a chip to the
 * surface's activeFilters list.
 */
export interface SectionPanelFilter {
  type?: string;
  label: string;
  value: string;
}

export interface SectionAddFilter {
  (type: string, label: string, value: string): void;
}
