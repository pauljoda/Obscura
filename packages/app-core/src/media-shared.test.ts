import { describe, expect, it } from "vitest";
import { schema } from "@obscura/db";
import {
  findOrCreatePerformerId,
  findOrCreateStudioId,
  findOrCreateTagId,
  type TxArg,
} from "./media-shared";

function createTx(existing: Record<string, string> | null = null) {
  const updates: Array<{ table: unknown; values: Record<string, unknown> }> = [];
  const inserts: Array<{ table: unknown; values: Record<string, unknown> }> = [];
  let activeInsertTable: unknown;

  const tx = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (existing ? [existing] : []),
        }),
      }),
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => {
        updates.push({ table, values });
        return { where: async () => undefined };
      },
    }),
    insert: (table: unknown) => {
      activeInsertTable = table;
      return {
        values: (values: Record<string, unknown>) => {
          inserts.push({ table, values });
          return {
            returning: async () => [{ id: `${table === schema.studios ? "studio" : table === schema.performers ? "performer" : "tag"}-new` }],
          };
        },
      };
    },
  } as unknown as TxArg;

  return {
    tx,
    updates,
    inserts,
    get activeInsertTable() {
      return activeInsertTable;
    },
  };
}

describe("media-shared relation helpers", () => {
  it("marks existing studios, performers, and tags as NSFW when requested", async () => {
    const studio = createTx({ id: "studio-1" });
    const performer = createTx({ id: "performer-1" });
    const tag = createTx({ id: "tag-1" });

    await expect(findOrCreateStudioId(studio.tx, "  Studio  ", { isNsfw: true })).resolves.toBe("studio-1");
    await expect(findOrCreatePerformerId(performer.tx, "  Performer  ", { isNsfw: true })).resolves.toBe("performer-1");
    await expect(findOrCreateTagId(tag.tx, "  Tag  ", { isNsfw: true })).resolves.toBe("tag-1");

    expect(studio.updates).toMatchObject([{ table: schema.studios, values: { isNsfw: true } }]);
    expect(performer.updates).toMatchObject([{ table: schema.performers, values: { isNsfw: true } }]);
    expect(tag.updates).toMatchObject([{ table: schema.tags, values: { isNsfw: true } }]);
    expect(studio.updates[0].values.updatedAt).toBeInstanceOf(Date);
    expect(performer.updates[0].values.updatedAt).toBeInstanceOf(Date);
    expect(tag.updates[0].values.updatedAt).toBeInstanceOf(Date);
  });

  it("propagates NSFW state into newly created studios, performers, and tags", async () => {
    const studio = createTx();
    const performer = createTx();
    const tag = createTx();

    await expect(findOrCreateStudioId(studio.tx, "  Studio  ", { isNsfw: true })).resolves.toBe("studio-new");
    await expect(findOrCreatePerformerId(performer.tx, "  Performer  ", { isNsfw: true })).resolves.toBe("performer-new");
    await expect(findOrCreateTagId(tag.tx, "  Tag  ", { isNsfw: true })).resolves.toBe("tag-new");

    expect(studio.inserts).toEqual([
      { table: schema.studios, values: { name: "Studio", isNsfw: true } },
    ]);
    expect(performer.inserts).toEqual([
      { table: schema.performers, values: { name: "Performer", isNsfw: true } },
    ]);
    expect(tag.inserts).toEqual([
      { table: schema.tags, values: { name: "Tag", isNsfw: true } },
    ]);
  });
});
