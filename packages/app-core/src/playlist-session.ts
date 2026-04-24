import { eq } from "drizzle-orm";
import type {
  CollectionItemDto,
  PlaylistSessionDto,
  PlaylistSessionWriteDto,
} from "@obscura/contracts";
import type { AppDb } from "@obscura/db";
import { schema } from "@obscura/db";

const { playlistSessions } = schema;

export const GLOBAL_PLAYLIST_SESSION_KEY = "global";

function isCollectionItem(value: unknown): value is CollectionItemDto {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CollectionItemDto>;
  return (
    typeof item.id === "string" &&
    typeof item.collectionId === "string" &&
    (item.entityType === "video" ||
      item.entityType === "gallery" ||
      item.entityType === "image" ||
      item.entityType === "audio-track") &&
    typeof item.entityId === "string" &&
    (item.source === "manual" || item.source === "dynamic") &&
    typeof item.sortOrder === "number" &&
    typeof item.addedAt === "string"
  );
}

function normalizeItems(items: unknown): CollectionItemDto[] {
  if (!Array.isArray(items)) return [];
  return items.filter(isCollectionItem);
}

function normalizePlayOrder(playOrder: unknown, itemCount: number): number[] {
  if (!Array.isArray(playOrder)) return [];
  const seen = new Set<number>();
  const normalized: number[] = [];

  for (const value of playOrder) {
    if (!Number.isInteger(value)) continue;
    if (value < 0 || value >= itemCount) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
  }

  return normalized;
}

export function normalizePlaylistSessionWrite(
  payload: PlaylistSessionWriteDto,
): PlaylistSessionWriteDto | null {
  const items = normalizeItems(payload.items);
  if (items.length === 0) return null;

  const playOrder = normalizePlayOrder(payload.playOrder, items.length);
  const effectiveOrder =
    playOrder.length > 0 ? playOrder : items.map((_, index) => index);
  const orderPosition = Math.max(
    0,
    Math.min(
      Number.isInteger(payload.orderPosition) ? payload.orderPosition : 0,
      effectiveOrder.length - 1,
    ),
  );

  return {
    collectionId: payload.collectionId || items[0]?.collectionId || null,
    collectionName:
      typeof payload.collectionName === "string" ? payload.collectionName : "",
    items,
    playOrder: effectiveOrder,
    orderPosition,
    shuffle: Boolean(payload.shuffle),
    loop: Boolean(payload.loop),
    slideshowDurationSeconds: Math.max(
      0,
      Math.floor(Number(payload.slideshowDurationSeconds) || 0),
    ),
  };
}

function toDto(
  row: typeof playlistSessions.$inferSelect,
): PlaylistSessionDto | null {
  const normalized = normalizePlaylistSessionWrite({
    collectionId: row.collectionId,
    collectionName: row.collectionName,
    items: row.items as CollectionItemDto[],
    playOrder: row.playOrder as number[],
    orderPosition: row.orderPosition,
    shuffle: row.shuffle,
    loop: row.loop,
    slideshowDurationSeconds: row.slideshowDurationSeconds,
  });
  if (!normalized) return null;
  return {
    ...normalized,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getPlaylistSessionRead(
  db: AppDb,
): Promise<PlaylistSessionDto | null> {
  const [row] = await db
    .select()
    .from(playlistSessions)
    .where(eq(playlistSessions.key, GLOBAL_PLAYLIST_SESSION_KEY))
    .limit(1);
  return row ? toDto(row) : null;
}

export async function setPlaylistSessionWrite(
  db: AppDb,
  payload: PlaylistSessionWriteDto,
): Promise<PlaylistSessionDto | null> {
  const normalized = normalizePlaylistSessionWrite(payload);
  if (!normalized) {
    await deletePlaylistSessionWrite(db);
    return null;
  }

  const updatedAt = new Date();
  const [row] = await db
    .insert(playlistSessions)
    .values({
      key: GLOBAL_PLAYLIST_SESSION_KEY,
      ...normalized,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: playlistSessions.key,
      set: {
        collectionId: normalized.collectionId,
        collectionName: normalized.collectionName,
        items: normalized.items,
        playOrder: normalized.playOrder,
        orderPosition: normalized.orderPosition,
        shuffle: normalized.shuffle,
        loop: normalized.loop,
        slideshowDurationSeconds: normalized.slideshowDurationSeconds,
        updatedAt,
      },
    })
    .returning();

  return toDto(row);
}

export async function deletePlaylistSessionWrite(
  db: AppDb,
): Promise<{ ok: true }> {
  await db
    .delete(playlistSessions)
    .where(eq(playlistSessions.key, GLOBAL_PLAYLIST_SESSION_KEY));
  return { ok: true as const };
}
