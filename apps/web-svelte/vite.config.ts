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
    // jassub ships browser-only worker assets we manage separately under
    // /static/jassub, so keep the package out of Vite's prebundle pass.
    exclude: ["jassub"],
  },
  ssr: {
    // Don't attempt to SSR-import jassub — it has browser-only globals.
    noExternal: [],
    external: ["jassub"],
  },
  define: {
    // @obscura/contracts reads these env keys at module scope. Vite does
    // not polyfill `process` in browser bundles, so we shim the shared
    // browser/server API base vars here.
    "process.env.PUBLIC_API_URL": JSON.stringify(""),
    "process.env.API_URL": JSON.stringify(""),
  },
});
