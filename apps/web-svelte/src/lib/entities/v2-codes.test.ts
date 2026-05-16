import { describe, expect, it } from "vitest";
import {
  ENTITY_FILE_ROLE,
  ENTITY_KINDS,
  isTopLevelEntityKind,
  labelForEntityKind,
  resolveEntityBrowsePath,
  resolveEntityHref,
} from "./v2-codes";

describe("v2 code registries", () => {
  it("covers every known v2 entity kind with a label", () => {
    for (const kind of ENTITY_KINDS) {
      expect(labelForEntityKind(kind)).not.toBe(kind);
    }
  });

  it("resolves browse paths for top-level entity kinds", () => {
    for (const kind of ENTITY_KINDS.filter(isTopLevelEntityKind)) {
      expect(resolveEntityBrowsePath(kind)).toMatch(/^\//);
    }
  });

  it("requires parent context for structural child routes", () => {
    expect(resolveEntityHref("book-chapter", "chapter")).toBeUndefined();
    expect(resolveEntityHref("book-chapter", "chapter", { kind: "book", id: "book" })).toBe(
      "/books/book/chapters/chapter",
    );
  });

  it("includes server image roles used by detail artwork", () => {
    expect(ENTITY_FILE_ROLE.backdrop).toBe("backdrop");
    expect(ENTITY_FILE_ROLE.logo).toBe("logo");
    expect(ENTITY_FILE_ROLE.poster).toBe("poster");
  });
});
