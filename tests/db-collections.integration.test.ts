import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "../packages/db/src/schema.ts";
import { getCollectionDetailRead } from "../packages/app-core/src/collections.ts";
import { NotFoundError } from "../packages/app-core/src/errors.ts";
import { createPostgresTestContext } from "./support/postgres.ts";

const { collections, collectionItems } = schema;

describe("collections reads", () => {
  let database: Awaited<ReturnType<typeof createPostgresTestContext>>;

  beforeAll(async () => {
    database = await createPostgresTestContext();
  });

  afterAll(async () => {
    await database.close();
  });

  beforeEach(async () => {
    await database.db.delete(collectionItems);
    await database.db.delete(collections);
  });

  it("treats NSFW collection details as not found in SFW mode", async () => {
    const [collection] = await database.db
      .insert(collections)
      .values({ name: "Hidden Set", isNsfw: true })
      .returning({ id: collections.id });

    await expect(
      getCollectionDetailRead(database.db, collection.id, { nsfw: "off" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
