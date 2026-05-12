namespace Obscura.Domain.Entities;

/// <summary>
/// Closed set of reader layouts supported by the book reading surface.
/// </summary>
public enum ReaderMode
{
    /// <summary>One page or spread at a time.</summary>
    Paged,

    /// <summary>Continuous vertical reading for long-strip comics and similar formats.</summary>
    Webtoon
}

/// <summary>
/// Codec for book reader layout codes.
/// </summary>
public sealed class ReaderModeCodec : EnumCodec<ReaderMode>
{
    public ReaderModeCodec()
        : base(new Dictionary<ReaderMode, string>
        {
            [ReaderMode.Paged] = "paged",
            [ReaderMode.Webtoon] = "webtoon"
        })
    {
    }
}
