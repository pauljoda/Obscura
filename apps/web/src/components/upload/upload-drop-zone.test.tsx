import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { UploadDropZone } from "./upload-drop-zone";

const uploadFiles = vi.fn();
const resetState = vi.fn();

vi.mock("./use-uploader", () => ({
  useUploader: () => ({
    uploadFiles,
    resetState,
    files: [],
    isUploading: false,
    needsRootPicker: false,
    candidateRoots: [],
    confirmRootPick: vi.fn(),
    cancelRootPick: vi.fn(),
    needsAudioLibraryPicker: false,
    candidateAudioLibraries: [],
    confirmAudioLibraryPick: vi.fn(),
    cancelAudioLibraryPick: vi.fn(),
  }),
}));

vi.mock("./library-root-picker", () => ({
  LibraryRootPicker: () => null,
}));

vi.mock("./audio-library-picker", () => ({
  AudioLibraryPicker: () => null,
}));

describe("UploadDropZone", () => {
  beforeEach(() => {
    uploadFiles.mockReset();
    resetState.mockReset();
  });

  it("shows the overlay during file drags and uploads dropped files", () => {
    render(
      <UploadDropZone target={{ kind: "video", libraryRootId: "root-1" }}>
        <div>content</div>
      </UploadDropZone>,
    );

    const dropZone = screen.getByText("content").parentElement!;
    const files = {
      0: new File(["video"], "clip.mp4", { type: "video/mp4" }),
      length: 1,
      item: () => null,
    } as unknown as FileList;
    const dataTransfer = {
      files,
      types: ["Files"],
      dropEffect: "copy",
    };

    fireEvent.dragEnter(dropZone, { dataTransfer });
    expect(screen.getByText(/Drop video files to import/i)).toBeInTheDocument();

    fireEvent.drop(dropZone, { dataTransfer });
    expect(uploadFiles).toHaveBeenCalledWith(files);
  });
});
