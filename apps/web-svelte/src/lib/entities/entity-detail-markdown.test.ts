import { describe, expect, it } from "vitest";
import { renderEntityDescriptionMarkdown } from "./entity-detail-markdown";

describe("entity detail markdown", () => {
  it("renders basic markdown while preserving safe external link attributes", () => {
    const html = renderEntityDescriptionMarkdown("A **bold** [site](https://example.com).");

    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("removes script tags, event handlers, and javascript links", () => {
    const html = renderEntityDescriptionMarkdown(
      '<script>alert("x")</script><img src=x onerror="alert(1)"> [bad](javascript:alert(1))',
    );

    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("javascript:");
  });
});
