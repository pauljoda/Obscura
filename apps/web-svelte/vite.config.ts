import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: {
    port: 8008,
    strictPort: false,
    proxy: {
      "/api": {
        target: "http://localhost:8010",
        changeOrigin: true,
      },
      "/assets": {
        target: "http://localhost:8010",
        changeOrigin: true,
      },
      "/openapi": {
        target: "http://localhost:8010",
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    exclude: ["jassub"],
  },
  ssr: {
    noExternal: [],
    external: ["jassub", "jsdom"],
  },
  define: {
    "process.env.PUBLIC_API_URL": JSON.stringify(""),
    "process.env.API_URL": JSON.stringify(""),
  },
});
