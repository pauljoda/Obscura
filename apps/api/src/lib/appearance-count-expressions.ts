/**
 * Re-export shim — the canonical helpers live in `@obscura/app-core` so
 * both the Fastify API and the SvelteKit server can share the same
 * correlated-subquery definitions without drifting.
 */
export {
  performerSfwSceneCountExpr,
  performerTotalSceneCountExpr,
  performerImageAppearanceCountExpr,
  performerAudioLibraryCountExpr,
  studioSfwSceneCountExpr,
  studioTotalSceneCountExpr,
  studioImageAppearanceCountExpr,
  studioAudioLibraryCountExpr,
  tagSfwSceneCountExpr,
  tagTotalSceneCountExpr,
} from "@obscura/app-core";
