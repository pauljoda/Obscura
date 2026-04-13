import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { NsfwProvider, useNsfw } from "./nsfw-context";

function Probe() {
  const { mode, toggleShowOffMode } = useNsfw();
  return (
    <div>
      <span>{mode}</span>
      <button onClick={toggleShowOffMode}>toggle</button>
    </div>
  );
}

describe("NsfwProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.cookie = "obscura-nsfw-mode=;path=/;max-age=0";
  });

  it("auto-enables show mode for LAN visitors when configured", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ isLan: true }), { status: 200 }),
      ),
    );

    render(
      <NsfwProvider lanAutoEnable>
        <Probe />
      </NsfwProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("show")).toBeInTheDocument();
    });
    expect(document.cookie).toContain("obscura-nsfw-mode=show");
  });

  it("toggles mode via the global hotkey", () => {
    render(
      <NsfwProvider initialMode="off">
        <Probe />
      </NsfwProvider>,
    );

    fireEvent.keyDown(window, {
      ctrlKey: true,
      shiftKey: true,
      code: "KeyZ",
      key: "z",
    });

    expect(screen.getByText("show")).toBeInTheDocument();
  });
});
