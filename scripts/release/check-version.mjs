import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
const changelog = readFileSync(new URL("../../CHANGELOG.md", import.meta.url), "utf8");
const expectedHeading = `## [${pkg.version}]`;

if (!changelog.includes("## [Unreleased]")) {
  console.error("CHANGELOG.md must contain an [Unreleased] section.");
  process.exit(1);
}

if (changelog.includes(expectedHeading)) {
  process.exit(0);
}

console.error(`CHANGELOG.md is missing a release heading for version ${pkg.version}.`);
process.exit(1);
