# Streaming Stability Design

**Goal:** Fix the current CPU-based video streaming path so HEVC direct playback is only used when the browser can actually play it, and adaptive HLS plays smoothly without avoidable audio stutter or quality thrash.

**Scope:** This pass intentionally excludes GPU transcoding. Hardware acceleration settings and Docker support will follow after the CPU streaming behavior is verified.

## Current Findings

Obscura exposes each video through two player paths:

- Direct source: `/api/video-stream/:id/source`
- Adaptive HLS: `/api/video-stream/:id/hls2/master.m3u8`

The direct route treats MKV/MOV/AVI-style sources as needing preparation and then either remuxes or transcodes to MP4. HEVC is currently considered remuxable, so an HEVC source may be copied into MP4 even when the active browser cannot decode HEVC or when the MP4 sample entry is not tagged in the Safari-friendly way.

The HLS route builds a complete VOD playlist up front and generates 6-second MPEG-TS segments on demand. Each segment is encoded by an independent ffmpeg process. This is easy to cache and gives full-timeline seeking, but the current timestamp and player startup choices can make hls.js rapidly switch quality or expose audio discontinuities at segment boundaries.

## Design

### Direct Playback Compatibility

Direct playback should become capability-driven instead of extension-driven.

The player will decide whether Direct should be offered or selected by checking the browser's native media support for the probed video/audio/container combination. HEVC direct playback requires a positive browser capability result for HEVC MP4 codec strings such as `hvc1` or `hev1`; otherwise the player should start with Adaptive HLS.

The server will still support direct source requests, but when remuxing HEVC to MP4 it will tag the video stream as `hvc1`. This mirrors Jellyfin's compatibility behavior and avoids MP4 files whose stream copy is valid but rejected by Safari-like clients.

If direct playback fails at runtime, the existing fallback to HLS remains, but it should become a backup path rather than the normal HEVC detection mechanism.

### HLS Smoothness

The virtual HLS route will remain the first-pass adaptive path. It already gives a full VOD seek window and avoids waiting for a full-file encode.

Segment generation should preserve continuous timestamps and keyframe-aligned output as much as possible without introducing GPU work. The ffmpeg arguments should be adjusted to reduce discontinuities at segment edges, keep audio timestamps stable, and avoid cache poisoning from incomplete segment writes.

The player should let hls.js perform normal adaptive bitrate startup instead of forcing the highest level in Auto mode. Manual quality selection remains available. hls.js fatal error handling should recover media errors when possible before tearing down the adaptive stream.

### Verification

The implementation should include focused unit tests for:

- Browser direct-play decisions for HEVC and non-HEVC sources.
- ffmpeg direct-remux args, including HEVC `hvc1` tagging.
- HLS segment command generation or behavior around timestamp options.
- Player load behavior so unsupported direct sources start in HLS.

Manual verification should include a video detail page in Chromium or Safari-compatible browser conditions, checking that HEVC files do not fail direct before HLS and that HLS playback starts without obvious quality bounce or audio gaps.

## Follow-Up: GPU Support

After CPU streaming is stable, add Linux Docker hardware acceleration as a separate project:

- Default remains CPU.
- Settings expose disabled/auto/manual hardware acceleration options.
- Linux Docker supports Intel QSV/VAAPI, NVIDIA NVENC/NVDEC, and AMD VAAPI.
- Diagnostics show ffmpeg hardware capability and required Docker device hints.
- Transcoding code consumes a small encoder-profile abstraction rather than scattering provider-specific ffmpeg args through routes.
