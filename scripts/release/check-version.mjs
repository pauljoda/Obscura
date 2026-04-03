import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
const changelog = readFileSync(new URL("../../CHANGELOG.md", import.meta.url), "utf8");
const expectedHeading = `## [${pkg.version}]`;
const semverPattern = /^\d+\.\d+\.\d+$/;
const requireReleaseHeading = process.argv.includes("--release");

if (!changelog.includes("## [Unreleased]")) {
  console.error("CHANGELOG.md must contain an [Unreleased] section.");
  process.exit(1);
}

if (!semverPattern.test(pkg.version)) {
  console.error(`package.json version "${pkg.version}" is not valid semver.`);
  process.exit(1);
}

if (!requireReleaseHeading) {
  process.exit(0);
}

if (!changelog.includes(expectedHeading)) {
  console.error(`CHANGELOG.md is missing a release heading for version ${pkg.version}.`);
  process.exit(1);
}
