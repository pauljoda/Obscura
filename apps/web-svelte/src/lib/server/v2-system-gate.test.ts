import { describe, expect, it, vi } from "vitest";
import {
  acceptAndPrepareV2Upgrade,
  promptV2UpgradeGate,
  readV2UpgradeGate,
  resolveV2ApiBase,
} from "./v2-system-gate";

function jsonResponse(payload: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("v2 system gate server client", () => {
  it("uses the local .NET API in development when no explicit v2 URL is configured", () => {
    expect(resolveV2ApiBase({}, true)).toBe("http://127.0.0.1:8010/api");
    expect(resolveV2ApiBase({ PUBLIC_V2_API_URL: "http://backend/api" }, true)).toBe(
      "http://backend/api",
    );
  });

  it("maps the v2 accepted flag to app-shell awaiting consent", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ gateId: "v2-global-entities", accepted: false }));

    const status = await readV2UpgradeGate(fetcher, "http://backend/api");

    expect(fetcher).toHaveBeenCalledWith("http://backend/api/system/v2-upgrade-gate", {
      method: "GET",
    });
    expect(status).toEqual({
      accepted: false,
      awaitingBreakingConsent: true,
      gateId: "v2-global-entities",
    });
  });

  it("accepts the gate and prepares the fresh-start reset before letting the app in", async () => {
    const calls: string[] = [];
    const fetcher = vi.fn(async (url: string) => {
      calls.push(url);
      if (url.endsWith("/accept")) {
        return jsonResponse({ gateId: "v2-global-entities", accepted: true });
      }
      return jsonResponse({
        backupPath: "/data/backups/pre-v2.dump",
        mediaReset: true,
        preservedLibraryRoots: 2,
        preservedSettings: true,
      });
    });

    const result = await acceptAndPrepareV2Upgrade(fetcher, "http://backend/api");

    expect(calls).toEqual([
      "http://backend/api/system/v2-upgrade-gate/accept",
      "http://backend/api/system/v2-fresh-start/prepare",
    ]);
    expect(result.prepared.mediaReset).toBe(true);
  });

  it("re-arms the backend v2 gate through the prompt endpoint", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ gateId: "v2-global-entities", accepted: false }));

    const result = await promptV2UpgradeGate(fetcher, "http://backend/api");

    expect(fetcher).toHaveBeenCalledWith("http://backend/api/system/v2-upgrade-gate/prompt", {
      method: "POST",
    });
    expect(result.awaitingBreakingConsent).toBe(true);
  });

  it("explains when the .NET v2 backend cannot be reached", async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });

    await expect(readV2UpgradeGate(fetcher, "http://backend/api")).rejects.toThrow(
      "Unable to reach the .NET v2 backend at http://backend/api",
    );
  });
});
