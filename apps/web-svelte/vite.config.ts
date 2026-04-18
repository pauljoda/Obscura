import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: {
    port: 8009,
    strictPort: false,
  },
  optimizeDeps: {
    // jassub ships IIFE workers that Vite can't pre-bundle; we load it
    // purely at runtime via a string-indirect dynamic import.
    exclude: ["jassub"],
  },
  ssr: {
    // Don't attempt to SSR-import jassub — it has browser-only globals.
    noExternal: [],
    external: ["jassub"],
  },
});
