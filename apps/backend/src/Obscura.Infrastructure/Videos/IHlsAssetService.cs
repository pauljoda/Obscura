namespace Obscura.Infrastructure.Videos;

public interface IHlsAssetService
{
    Task<HlsAsset?> GetAssetAsync(
        Guid id,
        string assetPath,
        CancellationToken cancellationToken);
}

public sealed record HlsAsset(
    string Path,
    string ContentType,
    string CacheControl);
