export const PAGE_CACHE_CONTROL =
  "private, max-age=30, stale-while-revalidate=300";

export const MUTABLE_ASSET_CACHE_CONTROL =
  "private, max-age=300, stale-while-revalidate=86400";

export const PRIVATE_IMMUTABLE_ASSET_CACHE_CONTROL =
  "private, max-age=31536000, immutable";

export const PRIVATE_DAILY_IMMUTABLE_ASSET_CACHE_CONTROL =
  "private, max-age=86400, immutable";

export const PRIVATE_HOURLY_ASSET_CACHE_CONTROL = "private, max-age=3600";

