import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";

const {
  mockFetchVideoDetail,
  mockVideoDetail,
} = vi.hoisted(() => ({
  mockFetchVideoDetail: vi.fn(),
  mockVideoDetail: vi.fn(
    ({ children }: { children?: ReactNode }) => (
      <div data-testid="video-detail">{children}</div>
    ),
  ),
}));

vi.mock("server-only", () => ({}));

vi.mock("../../../../lib/server-api/videos", () => ({
  fetchVideoDetail: mockFetchVideoDetail,
}));

vi.mock("../../../../components/video-detail", () => ({
  VideoDetail: mockVideoDetail,
}));

import VideoPage from "./page";

describe("videos/[id] page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchVideoDetail.mockResolvedValue({ id: "video-1", title: "Test video" });
  });

  it("renders the detail page without preloading tags", async () => {
    const element = await VideoPage({
      params: Promise.resolve({ id: "video-1" }),
    });

    render(element);

    expect(mockFetchVideoDetail).toHaveBeenCalledWith("video-1");
    expect(mockVideoDetail).toHaveBeenCalledTimes(1);
    const [props] = mockVideoDetail.mock.calls[0] ?? [];
    expect(props).toEqual({
      id: "video-1",
      initialVideo: expect.objectContaining({ id: "video-1" }),
    });
  });
});
