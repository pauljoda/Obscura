import type { PageServerLoad } from "./$types";

// Plugins page loads all state client-side (install/uninstall/toggle
// require interactivity), so the server loader is a no-op but still
// registers a `plugins` invalidation tag for future mutations.
export const load: PageServerLoad = async ({ depends }) => {
  depends("plugins");
  return {};
};
