namespace Obscura.Domain.Entities;

/// <summary>
/// Closed set of subtitle rendering styles supported by the playback UI.
/// </summary>
public enum SubtitleStyle {
    /// <summary>Obscura's styled subtitle presentation.</summary>
    Stylized,

    /// <summary>Plain browser-like subtitle presentation.</summary>
    Plain
}

/// <summary>
/// Codec for subtitle rendering style codes.
/// </summary>
public sealed class SubtitleStyleCodec : EnumCodec<SubtitleStyle> {
    public SubtitleStyleCodec()
        : base(new Dictionary<SubtitleStyle, string> {
            [SubtitleStyle.Stylized] = "stylized",
            [SubtitleStyle.Plain] = "plain"
        }) {
    }
}
