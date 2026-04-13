"use client";

/**
 * Plugins management page — install, configure, and manage
 * Obscura-native and Stash-compatible identification plugins.
 *
 * TODO: Full implementation in Phase E — currently shows a placeholder.
 */
export default function PluginsPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-heading-xl font-heading">Plugins</h1>
      <p className="text-text-muted">
        Plugin management page — coming soon. For now, use{" "}
        <a href="/settings" className="text-accent-400 underline">
          Settings
        </a>{" "}
        to manage metadata providers.
      </p>
    </div>
  );
}
