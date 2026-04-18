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
  define: {
    // @obscura/contracts reads `process.env.NEXT_PUBLIC_API_URL` /
    // `process.env.API_URL` at module scope. Next.js inlines these at
    // build time; Vite does not polyfill `process` in browser bundles,
    // so accessing it throws ReferenceError. Shim both to the empty
    // string so the `?? "http://localhost:4000"` fallback activates.
    // Server fetches in SvelteKit read INTERNAL_API_URL from
    // `$env/static/private`; client fetches read PUBLIC_API_URL from
    // `$env/static/public` — neither relies on @obscura/contracts'
    // API_BASE_URL.
    "process.env.NEXT_PUBLIC_API_URL": JSON.stringify(""),
    "process.env.API_URL": JSON.stringify(""),
  },
});
