import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
const changelog = readFileSync(new URL("../../CHANGELOG.md", import.meta.url), "utf8");
const expectedHeading = `## [${pkg.version}]`;
const semverPattern = /^\d+\.\d+\.\d+$/;
const releaseHeadingPattern = /^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})$/gm;
const requireReleaseHeading = process.argv.includes("--release");

if (!changelog.includes("## [Unreleased]")) {
  console.error("CHANGELOG.md must contain an [Unreleased] section.");
  process.exit(1);
}

if (!semverPattern.test(pkg.version)) {
  console.error(`package.json version "${pkg.version}" is not valid semver.`);
  process.exit(1);
}

const releaseHeadings = [...changelog.matchAll(releaseHeadingPattern)].map(
  ([, version]) => version,
);

if (releaseHeadings.length === 0) {
  console.error("CHANGELOG.md must contain at least one versioned release heading.");
  process.exit(1);
}

if (!requireReleaseHeading) {
  process.exit(0);
}

if (!changelog.includes(expectedHeading)) {
  console.error(`CHANGELOG.md is missing a release heading for version ${pkg.version}.`);
  process.exit(1);
}
