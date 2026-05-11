import { FolderInput, LayoutGrid, LayoutList } from "@lucide/svelte";
import type { BookListItemDto } from "@obscura/contracts";
import type {
  FilterSectionSpec,
  MediaSurfaceConfig,
} from "$lib/media-surface/config";
import { deleteBook, fetchBooks, updateBook } from "$lib/api/media";
import BookCard from "./BookCard.svelte";

type BookFilterType =
  | "rating"
  | "ratingMin"
  | "ratingMax"
  | "date"
  | "dateFrom"
  | "dateTo"
  | "organized"
  | "read"
  | "tag"
  | "performer"
  | "studio";

interface BuildArgs {
  initial: { items: BookListItemDto[]; total: number };
  pageSize: number;
  page: number;
  nsfwMode: string;
  onMutated?: () => void | Promise<void>;
  onConfirmDelete?: (selected: BookListItemDto[]) => void;
  onMerge?: (selected: BookListItemDto[]) => void;
}

export function booksSurfaceConfig(
  args: BuildArgs,
): MediaSurfaceConfig<BookListItemDto, BookFilterType> {
  const filterSections: FilterSectionSpec<BookFilterType>[] = [
    {
      kind: "rating",
      filterType: "rating",
      label: "Rating",
      rangeTypes: { min: "ratingMin", max: "ratingMax" },
    },
    {
      kind: "date-range",
      filterType: "date",
      label: "Date",
      rangeTypes: { min: "dateFrom", max: "dateTo" },
    },
    {
      kind: "enum",
      filterType: "organized",
      label: "Library flags",
      options: [
        { value: "true", label: "Organized" },
        { value: "false", label: "Not organized" },
      ],
    },
    {
      kind: "enum",
      filterType: "read",
      label: "Library flags",
      options: [
        { value: "unread", label: "Unread" },
        { value: "read", label: "Read" },
      ],
    },
  ];

  return {
    surfaceId: "books",
    pageSize: args.pageSize,
    initial: {
      items: args.initial.items,
      total: args.initial.total,
      loadedStart: (args.page - 1) * args.pageSize,
    },
    fetcher: async ({ offset, limit, signal, prefs }) => {
      const ratingMin = prefs.activeFilters.find((f) => f.type === "ratingMin")?.value;
      const ratingMax = prefs.activeFilters.find((f) => f.type === "ratingMax")?.value;
      const dateFrom = prefs.activeFilters.find((f) => f.type === "dateFrom")?.value;
      const dateTo = prefs.activeFilters.find((f) => f.type === "dateTo")?.value;
      const organized = prefs.activeFilters.find((f) => f.type === "organized")?.value;
      const read = prefs.activeFilters.find((f) => f.type === "read")?.value;
      const studio = prefs.activeFilters.find((f) => f.type === "studio")?.value;
      const tags = prefs.activeFilters.filter((f) => f.type === "tag").map((f) => f.value);
      const performers = prefs.activeFilters
        .filter((f) => f.type === "performer")
        .map((f) => f.value);

      const response = await fetchBooks(
        {
          search: prefs.search.trim() || undefined,
          sort: prefs.sortBy,
          order: prefs.sortDir,
          randomSeed: prefs.extras?.randomSeed?.toString(),
          studio,
          tag: tags,
          performer: performers,
          ratingMin: ratingMin ? Number(ratingMin) : undefined,
          ratingMax: ratingMax ? Number(ratingMax) : undefined,
          dateFrom,
          dateTo,
          organized,
          read,
          nsfw: args.nsfwMode,
          limit,
          offset,
        },
        { signal },
      );
      return { items: response.books, total: response.total };
    },
    card: BookCard,
    bodyLayout: "grid",
    layoutByViewMode: { grid: "grid", list: "list" },
    defaultPrefs: {
      viewMode: "grid",
      sortBy: "recent",
      sortDir: "desc",
      search: "",
      activeFilters: [],
      cols: 5,
    },
    sortOptions: [
      { value: "recent", label: "Recently Added" },
      { value: "date", label: "Book Date" },
      { value: "title", label: "Title A–Z" },
      { value: "pages", label: "Page Count" },
      { value: "rating", label: "Rating" },
      { value: "randomized", label: "Randomized" },
    ],
    defaultSortDir: {
      recent: "desc",
      date: "desc",
      title: "asc",
      pages: "desc",
      rating: "desc",
      randomized: "asc",
    },
    viewModes: [
      { mode: "grid", icon: LayoutGrid, label: "Grid view" },
      { mode: "list", icon: LayoutList, label: "List view" },
    ],
    filterSections,
    exclusiveFilterTypes: new Set([
      "ratingMin",
      "ratingMax",
      "dateFrom",
      "dateTo",
      "organized",
      "read",
      "studio",
    ]),
    searchPlaceholder: "Search books...",
    thumbSize: { min: 2, max: 8, default: 5, label: "Book card size" },
    bulkItemLabel: "books",
    bulkActions: [
      {
        id: "merge",
        label: "Merge into book",
        icon: FolderInput,
        handler: (selected) => {
          args.onMerge?.(selected);
        },
      },
      {
        id: "mark-nsfw",
        label: "Mark NSFW",
        handler: async (selected) => {
          await Promise.all(selected.map((book) => updateBook(book.id, { isNsfw: true })));
          await args.onMutated?.();
        },
      },
      {
        id: "delete",
        label: "Delete",
        variant: "danger",
        handler: async (selected) => {
          if (args.onConfirmDelete) {
            args.onConfirmDelete(selected);
            return;
          }
          await Promise.all(selected.map((book) => deleteBook(book.id)));
          await args.onMutated?.();
        },
      },
    ],
  };
}
