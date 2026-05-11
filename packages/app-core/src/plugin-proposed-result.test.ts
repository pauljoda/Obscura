import { describe, expect, it } from "vitest";
import { deriveProposedResultFromPluginOutput } from "./plugin-proposed-result";

describe("deriveProposedResultFromPluginOutput", () => {
  it("normalizes wrapped book payloads for MangaDex-style plugins", () => {
    const proposed = deriveProposedResultFromPluginOutput({
      kind: "book",
      book: {
        title: "She Was Cute Before",
        details: "Manga details.",
        date: "2024",
        urls: ["https://mangadex.org/title/manga-1/she-was-cute-before"],
        imageUrl: "https://uploads.mangadex.org/covers/manga-1/cover.jpg",
        performerNames: ["Author Name"],
        tagNames: ["Romance", "content: pornographic"],
        externalIds: { mangadex: "manga-1", language: "en" },
        isNsfw: true,
        candidates: [
          {
            externalIds: { mangadex: "manga-1", language: "en" },
            title: "She Was Cute Before",
            language: "en",
            contentRating: "pornographic",
            source: "mangadex",
          },
        ],
      },
    });

    expect(proposed).toMatchObject({
      title: "She Was Cute Before",
      details: "Manga details.",
      externalIds: { mangadex: "manga-1", language: "en" },
      isNsfw: true,
      candidates: [
        {
          externalIds: { mangadex: "manga-1", language: "en" },
          title: "She Was Cute Before",
          language: "en",
          contentRating: "pornographic",
          source: "mangadex",
        },
      ],
    });
  });

  it("normalizes gallery payloads without classifying them as series", () => {
    const proposed = deriveProposedResultFromPluginOutput({
      title: "Berserk",
      details: "Dark fantasy manga.",
      date: "1989",
      urls: ["https://mangadex.org/title/manga-1/berserk"],
      imageUrl: "https://uploads.mangadex.org/covers/manga-1/cover.jpg",
      performerNames: ["Kentaro Miura"],
      tagNames: ["Action", "content: safe"],
      externalIds: { mangadex: "manga-1", language: "en" },
      isNsfw: false,
      candidates: [
        {
          externalIds: { mangadex: "manga-1", language: "en" },
          title: "Berserk",
          language: "en",
          contentRating: "safe",
          source: "mangadex",
        },
      ],
    });

    expect(proposed).toMatchObject({
      title: "Berserk",
      details: "Dark fantasy manga.",
      externalIds: { mangadex: "manga-1", language: "en" },
      isNsfw: false,
      candidates: [
        {
          externalIds: { mangadex: "manga-1", language: "en" },
          title: "Berserk",
          language: "en",
          contentRating: "safe",
          source: "mangadex",
        },
      ],
    });
    expect(proposed).not.toHaveProperty("seasons");
  });
});
