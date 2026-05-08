/**
 * The app version, read at build time from apps/web-svelte/package.json.
 */
import packageJson from "../../package.json";

export const APP_VERSION = packageJson.version;
