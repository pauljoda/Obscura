"use client";
import { useEffect, useState } from "react";
import {
  acceptBreakingGate,
  fetchSystemStatus,
} from "../../lib/api/system";

type State = "loading" | "ready" | "accepting" | "restarting" | "normal";

const GITHUB_URL = "https://github.com/pauljoda/obscura";

export function BreakingUpgradeGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSystemStatus()
      .then((s) => {
        if (cancelled) return;
        setState(s.awaitingBreakingConsent ? "ready" : "normal");
      })
      .catch(() => {
        // API may be unreachable during local dev; render normally
        // rather than hard-blocking the UI forever.
        if (!cancelled) setState("normal");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading") return null;
  if (state === "normal") return <>{children}</>;

  const handleAccept = async () => {
    setState("accepting");
    setError(null);
    try {
      await acceptBreakingGate();
      setState("restarting");
      // Poll until the API comes back up without the gate.
      const deadline = Date.now() + 60_000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 2000));
        try {
          const s = await fetchSystemStatus();
          if (!s.awaitingBreakingConsent) {
            window.location.reload();
            return;
          }
        } catch {
          // API still restarting.
        }
      }
      setError("Upgrade took longer than expected. Refresh the page in a minute.");
    } catch (err) {
      setState("ready");
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0b0a08",
        color: "#e8e4dc",
        fontFamily: "Inter, sans-serif",
        padding: "2rem",
        overflow: "auto",
        zIndex: 9999,
      }}
    >
      <div style={{ maxWidth: "38rem", width: "100%" }}>
        <div
          style={{
            fontFamily: "Geist, sans-serif",
            fontSize: "1.5rem",
            fontWeight: 600,
            marginBottom: "1rem",
            color: "#c49a5a",
          }}
        >
          Thank you for being an early supporter of Obscura.
        </div>
        <p style={{ lineHeight: 1.6, marginBottom: "1rem" }}>
          This upgrade includes a one-time breaking change: the
          <strong> Scenes </strong>
          section has been replaced with a richer
          <strong> Videos </strong>
          model (series, seasons, episodes, and movies).
        </p>
        <p style={{ lineHeight: 1.6, marginBottom: "1rem" }}>
          Your video files on disk are untouched. The old
          <code
            style={{
              padding: "0 0.25rem",
              margin: "0 0.25rem",
              background: "rgba(255,255,255,0.06)",
              fontFamily: "JetBrains Mono, monospace",
            }}
          >
            scenes
          </code>
          database rows (including custom metadata, tags, and markers) will
          be dropped — after continuing, rescan your library roots to
          rebuild the new video entries.
        </p>
        <p style={{ lineHeight: 1.6, marginBottom: "1.5rem", opacity: 0.85 }}>
          Future updates are unlikely to require this kind of break.
        </p>
        {error && (
          <div
            style={{
              color: "#ff8080",
              marginBottom: "1rem",
              padding: "0.5rem 0.75rem",
              border: "1px solid rgba(255, 128, 128, 0.4)",
              background: "rgba(255, 128, 128, 0.08)",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "0.8125rem",
            }}
          >
            {error}
          </div>
        )}
        <div
          style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}
        >
          <button
            type="button"
            onClick={handleAccept}
            disabled={state === "accepting" || state === "restarting"}
            style={{
              borderRadius: 0,
              border: "1px solid rgba(196, 154, 90, 0.6)",
              background: "rgba(196, 154, 90, 0.32)",
              padding: "0.75rem 1.25rem",
              color: "inherit",
              fontFamily: "Inter, sans-serif",
              fontSize: "0.9375rem",
              fontWeight: 500,
              cursor:
                state === "accepting" || state === "restarting"
                  ? "default"
                  : "pointer",
            }}
          >
            {state === "accepting"
              ? "Accepting…"
              : state === "restarting"
                ? "Upgrading — waiting for service to come back…"
                : "I understand, continue upgrade"}
          </button>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            style={{ color: "#c49a5a", fontSize: "0.875rem" }}
          >
            Questions? Open an issue on GitHub →
          </a>
        </div>
      </div>
    </div>
  );
}
