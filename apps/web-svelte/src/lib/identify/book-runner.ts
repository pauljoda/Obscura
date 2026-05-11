import { acceptPluginResult, type PluginExecuteResult } from "$lib/api/scrapers";
import type { BookRow, NormalizedBookIdentifyResult } from "./identify-types";
import {
  resetPending,
  resolvePluginList,
  seekRow,
  type CommonRunProps,
  type PluginInfo,
  type RowUpdater,
} from "./runner-utils";

function rawBookPayload(rawResult: Record<string, unknown>): Record<string, unknown> {
  return rawResult.book && typeof rawResult.book === "object" && !Array.isArray(rawResult.book)
    ? (rawResult.book as Record<string, unknown>)
    : rawResult;
}

function optionalInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function bookResult(
  rawResult: Record<string, unknown>,
  normalized: NonNullable<PluginExecuteResult["normalized"]>,
): NormalizedBookIdentifyResult {
  const raw = rawBookPayload(rawResult);
  return {
    title: normalized.title,
    date: normalized.date,
    details: normalized.details,
    urls: Array.isArray(raw.urls)
      ? (raw.urls as string[])
      : normalized.url
        ? [normalized.url]
        : [],
    studioName: normalized.studioName,
    performerNames: normalized.performerNames ?? [],
    tagNames: normalized.tagNames ?? [],
    imageUrl: normalized.imageUrl,
    chapterImageUrl:
      typeof raw.chapterImageUrl === "string" ? raw.chapterImageUrl : undefined,
    chapterNumber: optionalInteger(raw.chapterNumber),
    imageCandidates: Array.isArray(raw.imageCandidates)
      ? (raw.imageCandidates as NormalizedBookIdentifyResult["imageCandidates"])
      : undefined,
    chapterImageCandidates: Array.isArray(raw.chapterImageCandidates)
      ? (raw.chapterImageCandidates as NormalizedBookIdentifyResult["chapterImageCandidates"])
      : undefined,
    chapterImageByNumber:
      raw.chapterImageByNumber &&
      typeof raw.chapterImageByNumber === "object" &&
      !Array.isArray(raw.chapterImageByNumber)
        ? (raw.chapterImageByNumber as NormalizedBookIdentifyResult["chapterImageByNumber"])
        : undefined,
    externalIds:
      raw.externalIds && typeof raw.externalIds === "object"
        ? (raw.externalIds as Record<string, string>)
        : undefined,
    candidates: Array.isArray(raw.candidates)
      ? (raw.candidates as NormalizedBookIdentifyResult["candidates"])
      : undefined,
    isNsfw: typeof raw.isNsfw === "boolean" ? raw.isNsfw : undefined,
  };
}

function buildBookInput(row: BookRow, includeNsfw = false): Record<string, unknown> {
  return {
    name: row.book.title,
    title: row.book.title,
    includeNsfw,
  };
}

const BOOK_ATTEMPTS = [
  { action: "bookByName", capabilityKey: "bookByName" },
  { action: "mangaByName", capabilityKey: "mangaByName" },
  { action: "comicByName", capabilityKey: "comicByName" },
  { action: "bookByFragment", capabilityKey: "bookByFragment" },
  { action: "mangaByFragment", capabilityKey: "mangaByFragment" },
  { action: "comicByFragment", capabilityKey: "comicByFragment" },
] as const;

function attemptsFor(row: BookRow, includeNsfw: boolean) {
  return BOOK_ATTEMPTS.map((attempt) => ({
    ...attempt,
    input: buildBookInput(row, includeNsfw),
  }));
}

export async function runBookIdentify(props: CommonRunProps<BookRow>): Promise<void> {
  props.setRunning(true);
  props.abortRef.current = false;

  const pluginList = resolvePluginList(props.selectedProviderId, props.plugins);
  resetPending(props.rows, props.setRows);

  for (let i = 0; i < props.rows.length; i++) {
    if (props.abortRef.current) break;
    const current = props.rows[i];
    if (current.status === "accepted") continue;

    props.setRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, status: "scraping" } : r)),
    );

    try {
      const { scrapeResultId, result, matchedProvider, error } = await seekRow({
        plugins: pluginList,
        entityId: current.book.id,
        attempts: attemptsFor(current, props.includeNsfw ?? false),
        buildResult: bookResult,
      });

      if (scrapeResultId && result) {
        if (props.autoAccept) {
          try {
            await acceptPluginResult(scrapeResultId);
            props.setRows((prev) =>
              prev.map((r, idx) =>
                idx === i
                  ? { ...r, status: "accepted", result, scrapeResultId, matchedProvider }
                  : r,
              ),
            );
          } catch {
            props.setRows((prev) =>
              prev.map((r, idx) =>
                idx === i
                  ? { ...r, status: "found", result, scrapeResultId, matchedProvider }
                  : r,
              ),
            );
          }
        } else {
          props.setRows((prev) =>
            prev.map((r, idx) =>
              idx === i
                ? { ...r, status: "found", result, scrapeResultId, matchedProvider }
                : r,
            ),
          );
        }
      } else if (error) {
        props.setRows((prev) =>
          prev.map((r, idx) => (idx === i ? { ...r, status: "error", error } : r)),
        );
      } else {
        props.setRows((prev) =>
          prev.map((r, idx) => (idx === i ? { ...r, status: "no-result" } : r)),
        );
      }
    } catch (err) {
      props.setRows((prev) =>
        prev.map((r, idx) =>
          idx === i
            ? { ...r, status: "error", error: err instanceof Error ? err.message : "Failed" }
            : r,
        ),
      );
    }
  }

  props.setRunning(false);
}

export async function seekBookSingle(
  idx: number,
  rows: BookRow[],
  setRows: RowUpdater<BookRow[]>,
  plugins: PluginInfo[],
  includeNsfw = false,
): Promise<void> {
  const row = rows[idx];
  if (!row || row.status === "accepted" || row.status === "scraping") return;

  setRows((prev) =>
    prev.map((r, i) => (i === idx ? { ...r, status: "scraping" } : r)),
  );

  const { scrapeResultId, result, matchedProvider, error } = await seekRow({
    plugins,
    entityId: row.book.id,
    attempts: attemptsFor(row, includeNsfw),
    buildResult: bookResult,
  });

  setRows((prev) =>
    prev.map((r, i) =>
      i === idx
        ? result
          ? { ...r, status: "found", result, scrapeResultId, matchedProvider }
          : error
            ? { ...r, status: "error", error }
            : { ...r, status: "no-result" }
        : r,
    ),
  );
}

export async function seekBookSingleByURL(
  idx: number,
  url: string,
  rows: BookRow[],
  setRows: RowUpdater<BookRow[]>,
  plugins: PluginInfo[],
  includeNsfw = false,
): Promise<void> {
  const row = rows[idx];
  if (!row || row.status === "accepted" || row.status === "scraping") return;
  const trimmedUrl = url.trim();
  if (!trimmedUrl) return;

  setRows((prev) =>
    prev.map((r, i) => (i === idx ? { ...r, status: "scraping" } : r)),
  );

  const { scrapeResultId, result, matchedProvider, error } = await seekRow({
    plugins,
    entityId: row.book.id,
    attempts: [
      {
        action: "bookByURL",
        input: { ...buildBookInput(row, includeNsfw), url: trimmedUrl },
        capabilityKey: "bookByURL",
      },
      {
        action: "mangaByURL",
        input: { ...buildBookInput(row, includeNsfw), url: trimmedUrl },
        capabilityKey: "mangaByURL",
      },
      {
        action: "comicByURL",
        input: { ...buildBookInput(row, includeNsfw), url: trimmedUrl },
        capabilityKey: "comicByURL",
      },
    ],
    buildResult: bookResult,
  });

  setRows((prev) =>
    prev.map((r, i) =>
      i === idx
        ? result
          ? { ...r, status: "found", result, scrapeResultId, matchedProvider }
          : error
            ? { ...r, status: "error", error }
            : { ...r, status: "no-result" }
        : r,
    ),
  );
}

export async function acceptAllBooks(
  rows: BookRow[],
  setRows: RowUpdater<BookRow[]>,
): Promise<void> {
  const found = rows
    .map((r, i) => ({ row: r, idx: i }))
    .filter(({ row }) => row.status === "found" && row.result);

  for (const { idx, row } of found) {
    const scrapeResultId = row.scrapeResultId;
    if (!scrapeResultId) continue;
    try {
      await acceptPluginResult(scrapeResultId, Array.from(row.selectedFields));
      setRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, status: "accepted" } : r)),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Accept failed";
      setRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, status: "error", error: message } : r)),
      );
    }
  }
}
