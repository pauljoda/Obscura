"use client";
import { useEffect, useState } from "react";
import {
  fetchSystemStatus,
  finalizeMigration,
  type SystemStatus,
} from "../../lib/api/system";

type ConfirmState = "idle" | "confirming" | "finalizing";

export function MigrationBanner() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchSystemStatus()
        .then((s) => {
          if (!cancelled) setStatus(s);
        })
        .catch((err) => {
          console.error("[migration-banner] fetchSystemStatus failed", err);
          if (!cancelled) {
            setError(err instanceof Error ? err.message : String(err));
          }
        });
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status) return null;
  const staged = status.migrations.find((m) => m.status === "staged");
  if (!staged) return null;

  const handleConfirm = async () => {
    console.log("[migration-banner] finalize clicked for", staged.name);
    setConfirmState("finalizing");
    setError(null);
    try {
      await finalizeMigration(staged.name);
      console.log("[migration-banner] finalize succeeded");
      const next = await fetchSystemStatus();
      setStatus(next);
      setConfirmState("idle");
    } catch (err) {
      console.error("[migration-banner] finalize failed", err);
      setError(err instanceof Error ? err.message : String(err));
      setConfirmState("idle");
    }
  };

  const finalizing = confirmState === "finalizing";
  const confirming = confirmState === "confirming";

  return (
    <div
      style={{
        borderBottom: "1px solid rgba(196, 154, 90, 0.35)",
        background:
          "linear-gradient(0deg, rgba(196, 154, 90, 0.07), rgba(196, 154, 90, 0.12))",
        padding: "0.75rem 1.25rem",
        color: "var(--text-primary, #e8e4dc)",
        fontFamily: "Inter, sans-serif",
        fontSize: "0.875rem",
      }}
      role="status"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 auto", minWidth: "20rem" }}>
          <strong style={{ fontFamily: "Geist, sans-serif" }}>
            Migration staged — {staged.name}
          </strong>
          <div style={{ opacity: 0.8, marginTop: "0.125rem" }}>
            {staged.description}
          </div>
          <div
            style={{
              opacity: 0.6,
              marginTop: "0.25rem",
              fontSize: "0.75rem",
            }}
          >
            The new typed video tables have been populated from your existing
            scenes. The legacy tables remain in place, so the existing UI
            continues to work; finalize simply marks this migration complete
            and unlocks the next round of cleanup work.
          </div>
          {error && (
            <div
              style={{
                color: "#ff8080",
                marginTop: "0.5rem",
                padding: "0.375rem 0.5rem",
                border: "1px solid rgba(255, 128, 128, 0.4)",
                background: "rgba(255, 128, 128, 0.08)",
                fontSize: "0.75rem",
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              Finalize failed: {error}
            </div>
          )}
        </div>
        {!confirming && (
          <button
            type="button"
            onClick={() => {
              console.log("[migration-banner] finalize button pressed");
              setConfirmState("confirming");
            }}
            disabled={finalizing}
            style={{
              borderRadius: 0,
              border: "1px solid rgba(196, 154, 90, 0.6)",
              background: finalizing
                ? "rgba(196, 154, 90, 0.2)"
                : "rgba(196, 154, 90, 0.32)",
              padding: "0.5rem 1rem",
              color: "inherit",
              fontFamily: "Inter, sans-serif",
              fontSize: "0.8125rem",
              fontWeight: 500,
              cursor: finalizing ? "default" : "pointer",
            }}
          >
            {finalizing ? "Finalizing…" : "Finalize migration"}
          </button>
        )}
        {confirming && (
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", opacity: 0.8 }}>
              Are you sure?
            </span>
            <button
              type="button"
              onClick={handleConfirm}
              style={{
                borderRadius: 0,
                border: "1px solid rgba(196, 154, 90, 0.6)",
                background: "rgba(196, 154, 90, 0.32)",
                padding: "0.5rem 1rem",
                color: "inherit",
                fontFamily: "Inter, sans-serif",
                fontSize: "0.8125rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Yes, finalize
            </button>
            <button
              type="button"
              onClick={() => setConfirmState("idle")}
              style={{
                borderRadius: 0,
                border: "1px solid rgba(255, 255, 255, 0.2)",
                background: "transparent",
                padding: "0.5rem 1rem",
                color: "inherit",
                fontFamily: "Inter, sans-serif",
                fontSize: "0.8125rem",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
