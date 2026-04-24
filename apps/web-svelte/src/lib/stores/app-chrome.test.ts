import { describe, expect, it } from "vitest";
import { AppChromeStore } from "./app-chrome.svelte";

describe("AppChromeStore bottom dock inset", () => {
  it("uses the tallest registered dock and clears it when unregistered", () => {
    const chrome = new AppChromeStore(false);

    chrome.setBottomDockInset("audio", 148);
    chrome.setBottomDockInset("preview", 72);

    expect(chrome.bottomDockInsetPx).toBe(148);

    chrome.clearBottomDockInset("audio");
    expect(chrome.bottomDockInsetPx).toBe(72);

    chrome.clearBottomDockInset("preview");
    expect(chrome.bottomDockInsetPx).toBe(0);
  });
});
