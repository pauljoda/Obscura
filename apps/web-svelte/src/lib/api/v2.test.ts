import { afterEach, describe, expect, it, vi } from "vitest";
import { updateV2EntityMetadata, type V2EntityMetadataUpdateRequest } from "./v2";

describe("v2 api helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("patches entity metadata through the kind-aware route when kind is known", async () => {
    const request: V2EntityMetadataUpdateRequest = {
      fields: ["title"],
      patch: {
        title: "New title",
        description: null,
        externalIds: {},
        urls: [],
        tags: [],
        studio: null,
        credits: [],
        dates: {},
        stats: {},
        positions: {},
        classification: null,
      },
    };
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ id: "entity-1", kind: "video-series", title: "New title" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await updateV2EntityMetadata("entity-1", request, { kind: "video-series" });

    expect(fetchMock).toHaveBeenCalledWith("/api/entities/video-series/entity-1", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify(request),
    }));
  });
});
