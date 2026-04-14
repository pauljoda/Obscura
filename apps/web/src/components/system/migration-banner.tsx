"use client";
import { useEffect, useState } from "react";
import {
  fetchSystemStatus,
  finalizeMigration,
  type SystemStatus,
} from "../../lib/api/system";

export function MigrationBanner() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSystemStatus()
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch(() => {
        /* keep banner hidden on error */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status) return null;
  const staged = status.migrations.find((m) => m.status === "staged");
  if (!staged) return null;

  const handleFinalize = async () => {
    if (
      !window.confirm(
        `Finalize "${staged.name}"? This will drop the legacy scenes and scene_folders tables. Your existing UI may break until the new UI is released. This action is irreversible.`,
      )
    ) {
      return;
    }
    setFinalizing(true);
    setError(null);
    try {
      await finalizeMigration(staged.name);
      const next = await fetchSystemStatus();
      setStatus(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setFinalizing(false);
    }
  };

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
            Library scans are paused until you finalize. Finalizing drops the
            legacy <code>scenes</code> and <code>scene_folders</code> tables —
            the current UI depends on these and will break until the new UI
            ships. Only finalize if you know what you&apos;re doing.
          </div>
          {error && (
            <div style={{ color: "#ff8080", marginTop: "0.25rem" }}>
              {error}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleFinalize}
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
      </div>
    </div>
  );
}
