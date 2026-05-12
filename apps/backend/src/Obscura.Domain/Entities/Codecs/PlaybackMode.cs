namespace Obscura.Domain.Entities;

/// <summary>
/// Closed set of preferred playback startup strategies.
/// </summary>
public enum PlaybackMode
{
    /// <summary>Try direct playback first when the browser can play the source.</summary>
    Direct,

    /// <summary>Use HLS playback when a stream is available or can be generated.</summary>
    Hls
}

/// <summary>
/// Codec for playback mode codes.
/// </summary>
public sealed class PlaybackModeCodec : EnumCodec<PlaybackMode>
{
    public PlaybackModeCodec()
        : base(new Dictionary<PlaybackMode, string>
        {
            [PlaybackMode.Direct] = "direct",
            [PlaybackMode.Hls] = "hls"
        })
    {
    }
}
