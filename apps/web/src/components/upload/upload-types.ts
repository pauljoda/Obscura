import type {
  AudioLibraryListItemDto,
  LibraryRootSummaryDto,
} from "@obscura/contracts";

/** Describes where an upload should land. */
export type UploadTarget =
  | { kind: "video"; libraryRootId?: string; videoSeriesId?: string }
  | { kind: "image"; galleryId: string }
  | { kind: "audio"; audioLibraryId?: string };

export type UploadCategory = "video" | "image" | "audio";

export function categoryForTarget(target: UploadTarget): UploadCategory {
  switch (target.kind) {
    case "video":
      return "video";
    case "image":
      return "image";
    case "audio":
      return "audio";
  }
}

/**
 * HTML accept attribute per category. Matches the server-side allow-list
 * in apps/api/src/lib/upload.ts — keep them in sync.
 */
export function acceptForCategory(category: UploadCategory): string {
  switch (category) {
    case "video":
      return "video/*,.mkv,.mp4,.mov,.webm,.avi,.m4v,.wmv,.flv,.ts,.mpg,.mpeg";
    case "image":
      return "image/*,.jpg,.jpeg,.png,.webp,.gif,.avif,.bmp,.tif,.tiff";
    case "audio":
      return "audio/*,.mp3,.flac,.m4a,.aac,.ogg,.opus,.wav,.wma";
  }
}

export interface UploadFileProgress {
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

export interface UseUploaderState {
  files: UploadFileProgress[];
  isUploading: boolean;
  needsRootPicker: boolean;
  candidateRoots: LibraryRootSummaryDto[];
  needsAudioLibraryPicker: boolean;
  candidateAudioLibraries: AudioLibraryListItemDto[];
}
