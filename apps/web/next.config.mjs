import path from "node:path";
import { fileURLToPath } from "node:url";

const configDir = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: false,
  output: "standalone",
  outputFileTracingRoot: path.join(configDir, "../.."),
  outputFileTracingIncludes: {
    "/api/changelog": ["../../CHANGELOG.md"],
  },
};

export default nextConfig;
