namespace Obscura.Domain.Capabilities;

public sealed record Images(string? ThumbnailUrl, string? CoverUrl)
{
    public static Images Empty { get; } = new(null, null);
}
