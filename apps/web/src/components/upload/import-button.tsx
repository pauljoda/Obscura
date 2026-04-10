"use client";

import { useRef } from "react";
import { Upload } from "lucide-react";
import { Button } from "@obscura/ui/primitives/button";
import {
  acceptForCategory,
  categoryForTarget,
  type UploadTarget,
} from "./upload-types";
import { useUploader } from "./use-uploader";
import { LibraryRootPicker } from "./library-root-picker";
import { AudioLibraryPicker } from "./audio-library-picker";

interface ImportButtonProps {
  target: UploadTarget;
  onUploaded?: () => void;
  label?: string;
  disabled?: boolean;
}

/**
 * Header-bar button that opens a file picker and runs the upload through
 * the same pipeline as <UploadDropZone>. Shares use-uploader so the scene
 * root picker and per-file error surfacing behave the same.
 *
 * Intentionally does NOT render the status strip — pair this with an
 * UploadDropZone on the same view, or mount the status strip elsewhere.
 * In practice every integration already wraps the page in UploadDropZone,
 * so the strip is visible regardless of which entry point was used.
 */
export function ImportButton({
  target,
  onUploaded,
  label,
  disabled,
}: ImportButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const uploader = useUploader({ target, onUploaded });
  const category = categoryForTarget(target);
  const accept = acceptForCategory(category);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      void uploader.uploadFiles(files);
    }
    // Allow selecting the same file twice in a row.
    e.target.value = "";
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />
      <Button
        variant="secondary"
        size="md"
        onClick={handleClick}
        disabled={disabled}
      >
        <Upload className="h-3.5 w-3.5" />
        {label ?? "Import"}
      </Button>
      <LibraryRootPicker
        open={uploader.needsRootPicker}
        roots={uploader.candidateRoots}
        onConfirm={uploader.confirmRootPick}
        onCancel={uploader.cancelRootPick}
      />
      <AudioLibraryPicker
        open={uploader.needsAudioLibraryPicker}
        libraries={uploader.candidateAudioLibraries}
        onConfirm={uploader.confirmAudioLibraryPick}
        onCancel={uploader.cancelAudioLibraryPick}
      />
    </>
  );
}
