import type { FingerprintKind } from "@obscura/media-core";

export interface ImportedFingerprint {
  source: "stash";
  kind: FingerprintKind | string;
  value: string;
}

export interface BootstrapImportSummary {
  source: "stash";
  fingerprints: number;
  metadataEntities: number;
}

