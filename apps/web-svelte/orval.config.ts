import { defineConfig } from "orval";

const openApiUrl =
  process.env.OBSCURA_OPENAPI_URL ?? "http://127.0.0.1:8008/openapi/v1.json";

export default defineConfig({
  obscuraV2: {
    input: {
      target: openApiUrl,
    },
    output: {
      mode: "split",
      target: "src/lib/api/generated/obscura-v2.ts",
      schemas: "src/lib/api/generated/model",
      client: "fetch",
      clean: true,
      prettier: true,
      override: {
        mutator: {
          path: "src/lib/api/orval-fetch.ts",
          name: "orvalFetch",
        },
      },
    },
  },
});
