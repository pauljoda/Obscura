import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: {
    port: 8008,
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
    // Client fetches in SvelteKit read PUBLIC_API_URL from
    // `$env/static/public`; server-side code uses same-origin `/api`.
    "process.env.NEXT_PUBLIC_API_URL": JSON.stringify(""),
    "process.env.API_URL": JSON.stringify(""),
  },
});
