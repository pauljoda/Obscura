namespace Obscura.Contracts.Entities;

/// <summary>API-facing shared artwork capability.</summary>
/// <param name="ThumbnailUrl">Small artwork URL for cards and rows.</param>
/// <param name="CoverUrl">Large artwork URL for detail surfaces.</param>
public sealed record ImagesCapability(string? ThumbnailUrl, string? CoverUrl) : EntityCapability;
