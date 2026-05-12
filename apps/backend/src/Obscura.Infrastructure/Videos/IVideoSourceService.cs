namespace Obscura.Infrastructure.Videos;

public interface IVideoSourceService
{
    Task<VideoSourceFile?> GetSourceAsync(Guid id, CancellationToken cancellationToken);
}

public sealed record VideoSourceFile(
    Guid EntityId,
    string Path,
    string ContentType,
    bool DirectPlayable);
