using Microsoft.EntityFrameworkCore;
using Obscura.Application.Files;
using Obscura.Contracts.Files;
using Obscura.Domain.Entities;
using Obscura.Infrastructure.Persistence;

namespace Obscura.Infrastructure.Files;

/// <summary>
/// EF Core adapter for Files page root metadata, linked-entity lookup, and source-path
/// rewrite operations after filesystem moves.
/// </summary>
public sealed class EfFilesPersistence(ObscuraDbContext db) : IFilesPersistence {
    /// <inheritdoc />
    public async Task<IReadOnlyList<FileLibraryRoot>> ListRootsAsync(CancellationToken cancellationToken) =>
        await db.LibraryRoots.AsNoTracking()
            .OrderBy(root => root.Label)
            .Select(root => new FileLibraryRoot(
                root.Id,
                root.Path,
                root.Label,
                root.Enabled,
                root.ScanVideos,
                root.ScanImages,
                root.ScanAudio,
                root.ScanBooks,
                root.IsNsfw))
            .ToArrayAsync(cancellationToken);

    /// <inheritdoc />
    public async Task<FileLibraryRoot?> GetRootAsync(Guid rootId, CancellationToken cancellationToken) =>
        await db.LibraryRoots.AsNoTracking()
            .Where(root => root.Id == rootId)
            .Select(root => new FileLibraryRoot(
                root.Id,
                root.Path,
                root.Label,
                root.Enabled,
                root.ScanVideos,
                root.ScanImages,
                root.ScanAudio,
                root.ScanBooks,
                root.IsNsfw))
            .FirstOrDefaultAsync(cancellationToken);

    /// <inheritdoc />
    public async Task<IReadOnlyList<FileLinkedEntity>> ListLinkedEntitiesAsync(
        string absolutePath,
        CancellationToken cancellationToken) {
        var normalized = Path.GetFullPath(absolutePath);
        var entities = await db.EntityFiles.AsNoTracking()
            .Where(file => file.Role == EntityFileRole.Source &&
                           (file.Path == normalized || EF.Functions.Like(file.Path, normalized + Path.DirectorySeparatorChar + "%")))
            .Join(
                db.Entities.AsNoTracking().Where(entity => entity.DeletedAt == null),
                file => file.EntityId,
                entity => entity.Id,
                (_, entity) => entity)
            .Distinct()
            .ToArrayAsync(cancellationToken);

        if (entities.Length == 0) return [];

        var ids = entities.Select(e => e.Id).ToArray();
        var coverByEntity = await db.EntityFiles.AsNoTracking()
            .Where(file => ids.Contains(file.EntityId))
            .Where(file => file.Role == EntityFileRole.Thumbnail || file.Role == EntityFileRole.Poster ||
                           file.Role == EntityFileRole.Cover || file.Role == EntityFileRole.Backdrop)
            .OrderBy(file => file.Role == EntityFileRole.Thumbnail ? 0 :
                file.Role == EntityFileRole.Poster ? 1 :
                file.Role == EntityFileRole.Cover ? 2 : 3)
            .ThenBy(file => file.CreatedAt)
            .GroupBy(file => file.EntityId)
            .Select(group => new { group.Key, Path = group.First().Path })
            .ToDictionaryAsync(x => x.Key, x => x.Path, cancellationToken);

        return entities.Select(entity => new FileLinkedEntity(
            entity.Id,
            entity.KindCode,
            entity.Title,
            coverByEntity.GetValueOrDefault(entity.Id))).ToArray();
    }

    /// <inheritdoc />
    public async Task ApplyPathPrefixRewriteAsync(
        string sourcePath,
        string targetPath,
        CancellationToken cancellationToken) {
        var source = Path.TrimEndingDirectorySeparator(Path.GetFullPath(sourcePath));
        var target = Path.TrimEndingDirectorySeparator(Path.GetFullPath(targetPath));
        var now = DateTimeOffset.UtcNow;
        var files = await db.EntityFiles
            .Where(file => file.Role == EntityFileRole.Source)
            .ToArrayAsync(cancellationToken);

        foreach (var file in files) {
            if (!TryMapMovedPath(file.Path, source, target, out var nextPath)) {
                continue;
            }

            file.Path = nextPath;
            file.UpdatedAt = now;
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    private static bool TryMapMovedPath(
        string currentPath,
        string sourcePath,
        string targetPath,
        out string nextPath) {
        var current = Path.GetFullPath(currentPath);
        if (string.Equals(current, sourcePath, StringComparison.OrdinalIgnoreCase)) {
            nextPath = targetPath;
            return true;
        }

        if (current.StartsWith(sourcePath + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) {
            nextPath = targetPath + current[sourcePath.Length..];
            return true;
        }

        nextPath = currentPath;
        return false;
    }
}
