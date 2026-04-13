import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "tests/**/*.integration.test.ts",
      "apps/api/src/**/*.integration.test.ts",
      "apps/worker/src/**/*.integration.test.ts",
    ],
    exclude: ["**/.next/**", "**/dist/**"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage/integration",
      thresholds: {
        lines: 65,
        statements: 65,
        functions: 65,
        branches: 50,
      },
    },
  },
});
