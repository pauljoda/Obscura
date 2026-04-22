import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import SubtitleSettingsPanel from "./SubtitleSettingsPanel.svelte";

describe("SubtitleSettingsPanel", () => {
  it("exposes subtitle settings as a dialog", () => {
    render(SubtitleSettingsPanel, {
      props: {
        appearance: {
          style: "stylized",
          fontScale: 1,
          positionPercent: 92,
          opacity: 1,
        },
        hasLocalOverride: false,
        onClose: () => {},
        onChange: () => {},
        onReset: () => {},
      },
    });

    expect(
      screen.getByRole("dialog", { name: /subtitle style/i }),
    ).toBeInTheDocument();
  });
});
