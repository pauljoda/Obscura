namespace Obscura.Domain.Entities;

/// <summary>
/// Closed set of layouts for displaying a video series detail view.
/// </summary>
public enum VideoSeriesRenderingMode {
    /// <summary>Render all videos as one flat list.</summary>
    Flat,

    /// <summary>Render videos grouped beneath season entities.</summary>
    Seasons
}

/// <summary>
/// Codec for video-series rendering mode codes.
/// </summary>
public sealed class VideoSeriesRenderingModeCodec : EnumCodec<VideoSeriesRenderingMode> {
    public VideoSeriesRenderingModeCodec()
        : base(new Dictionary<VideoSeriesRenderingMode, string> {
            [VideoSeriesRenderingMode.Flat] = "flat",
            [VideoSeriesRenderingMode.Seasons] = "seasons"
        }) {
    }
}
