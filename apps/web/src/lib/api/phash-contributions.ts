import { buildQueryString, fetchApi } from "./core";

export type FingerprintAlgorithm = "MD5" | "OSHASH" | "PHASH";

export interface PhashContributionStashId {
  id: string;
  endpointId: string;
  endpointName: string;
  stashId: string;
}

export interface PhashContributionScene {
  id: string;
  title: string;
  thumbnailPath: string | null;
  duration: number | null;
  checksumMd5: string | null;
  oshash: string | null;
  phash: string | null;
}

export interface PhashContributionSubmission {
  endpointId: string;
  algorithm: FingerprintAlgorithm;
  hash: string;
  status: "success" | "error";
  error: string | null;
  submittedAt: string;
}

export interface PhashContributionItem {
  scene: PhashContributionScene;
  stashIds: PhashContributionStashId[];
  submissions: PhashContributionSubmission[];
}

export interface PhashContributionsResponse {
  total: number;
  page: number;
  pageSize: number;
  items: PhashContributionItem[];
}

export async function listPhashContributions(params?: {
  page?: number;
  pageSize?: number;
}): Promise<PhashContributionsResponse> {
  const qs = buildQueryString({
    page: params?.page,
    pageSize: params?.pageSize,
  });
  return fetchApi(`/phash-contributions${qs}`);
}

export interface SubmitFingerprintsResponse {
  submissions: Array<{
    algorithm: FingerprintAlgorithm;
    hash: string;
    status: "success" | "error";
    error?: string;
  }>;
}

export async function submitFingerprintsToEndpoint(
  endpointId: string,
  sceneId: string,
  algorithms?: FingerprintAlgorithm[],
): Promise<SubmitFingerprintsResponse> {
  return fetchApi(`/stashbox-endpoints/${endpointId}/submit-fingerprints`, {
    method: "POST",
    body: JSON.stringify({ sceneId, ...(algorithms ? { algorithms } : {}) }),
  });
}
