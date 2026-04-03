export const supportedFingerprintKinds = [
  "md5",
  "oshash",
  "image-phash",
  "video-phash"
] as const;

export type FingerprintKind = (typeof supportedFingerprintKinds)[number];

export interface LibraryRoot {
  id: string;
  path: string;
  enabled: boolean;
}

