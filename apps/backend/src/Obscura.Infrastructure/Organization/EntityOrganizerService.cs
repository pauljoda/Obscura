using Microsoft.EntityFrameworkCore;
using Obscura.Application.Organization;
using Obscura.Domain.Entities;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Organization;

/// <summary>
/// Computes generic entity organization plans from source paths, structural parents, and entity-kind storage metadata.
/// </summary>
public sealed class EntityOrganizerService(ObscuraDbContext db) : IEntityOrganizer
{
    private const string Ready = "ready";
    private const string Unchanged = "unchanged";
    private const string Skipped = "skipped";
    private const string Applied = "applied";
    private const string Failed = "failed";

    /// <inheritdoc />
    public async Task<OrganizePlanResult> PlanAsync(
        OrganizePlanQuery request,
        CancellationToken cancellationToken)
    {
        var plan = await BuildPlanAsync(request, cancellationToken);
        return new OrganizePlanResult(plan);
    }

    /// <inheritdoc />
    public async Task<OrganizeApplyResult> ApplyAsync(
        OrganizePlanQuery request,
        CancellationToken cancellationToken)
    {
        var plan = await BuildPlanAsync(request, cancellationToken);
        var ancestorMoveSources = plan
            .Where(item => item.Status == Ready)
            .Select(item => item.SourcePath)
            .OrderBy(path => path.Length)
            .ToArray();
        var results = new List<OrganizePlanItemResult>(plan.Count);
        var applied = 0;

        foreach (var item in plan)
        {
            cancellationToken.ThrowIfCancellationRequested();

            if (item.Status != Ready)
            {
                results.Add(item);
                continue;
            }

            if (ancestorMoveSources.Any(path =>
                    !SamePath(path, item.SourcePath) &&
                    IsSubPathOf(item.SourcePath, path)))
            {
                results.Add(item with
                {
                    Status = Skipped,
                    Reason = "A parent folder is being moved first. Run organize again to apply child renames."
                });
                continue;
            }

            try
            {
                MoveSource(item.SourcePath, item.TargetPath);
                await UpdateMovedPathPrefixesAsync(item.SourcePath, item.TargetPath, cancellationToken);
                results.Add(item with { Status = Applied });
                applied++;
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                results.Add(item with { Status = Failed, Reason = ex.Message });
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        return new OrganizeApplyResult(results, applied, results.Count - applied);
    }

    private async Task<IReadOnlyList<OrganizePlanItemResult>> BuildPlanAsync(
        OrganizePlanQuery request,
        CancellationToken cancellationToken)
    {
        var roots = await db.LibraryRoots.AsNoTracking()
            .Where(root => request.RootId == null || root.Id == request.RootId)
            .ToArrayAsync(cancellationToken);
        var rootPaths = roots
            .Select(root => (root.Id, Path: Normalize(root.Path)))
            .OrderByDescending(root => root.Path.Length)
            .ToArray();

        var entities = await db.Entities.AsNoTracking()
            .Where(entity => entity.DeletedAt == null)
            .Where(entity => request.EntityId == null || entity.Id == request.EntityId)
            .ToArrayAsync(cancellationToken);
        var entityIds = entities.Select(entity => entity.Id).ToArray();
        var sourceFiles = await db.EntityFiles.AsNoTracking()
            .Where(file => file.Role == EntityFileRole.Source)
            .Where(file => entityIds.Contains(file.EntityId))
            .ToArrayAsync(cancellationToken);

        var entityById = entities.ToDictionary(entity => entity.Id);
        var sourceByEntityId = sourceFiles
            .GroupBy(file => file.EntityId)
            .ToDictionary(group => group.Key, group => group.OrderBy(file => file.CreatedAt).First());
        var memo = new Dictionary<Guid, OrganizePlanItemResult?>();

        return entities
            .Select(entity => BuildItem(entity.Id, entityById, sourceByEntityId, rootPaths, memo))
            .OfType<OrganizePlanItemResult>()
            .OrderBy(item => item.SourcePath, StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    private static OrganizePlanItemResult? BuildItem(
        Guid entityId,
        IReadOnlyDictionary<Guid, EntityRow> entityById,
        IReadOnlyDictionary<Guid, EntityFileRow> sourceByEntityId,
        IReadOnlyList<(Guid Id, string Path)> rootPaths,
        IDictionary<Guid, OrganizePlanItemResult?> memo)
    {
        if (memo.TryGetValue(entityId, out var cached))
        {
            return cached;
        }

        if (!entityById.TryGetValue(entityId, out var entity) ||
            !sourceByEntityId.TryGetValue(entityId, out var sourceFile) ||
            !EntityKindRegistry.TryGet(entity.KindCode, out var kind))
        {
            memo[entityId] = null;
            return null;
        }

        var metadata = EntityKindMetadataRegistry.Require(kind);
        var storageShape = metadata.StorageShape;
        var sourcePath = Normalize(sourceFile.Path);
        if (storageShape is EntityStorageShape.None or EntityStorageShape.ArchiveEntry)
        {
            var skipped = NewItem(entity, storageShape, sourcePath, sourcePath, Skipped,
                storageShape == EntityStorageShape.ArchiveEntry
                    ? "Archive entries are not moved independently."
                    : "This entity kind has no direct filesystem storage.");
            memo[entityId] = skipped;
            return skipped;
        }

        var targetContainer = ResolveTargetContainer(entity, entityById, sourceByEntityId, rootPaths, memo);
        if (targetContainer is null)
        {
            var skipped = NewItem(entity, storageShape, sourcePath, sourcePath, Skipped,
                "No library root contains the entity source path.");
            memo[entityId] = skipped;
            return skipped;
        }

        var targetPath = storageShape switch
        {
            EntityStorageShape.Folder => Path.Combine(targetContainer, SafePathSegment(entity.Title, entity.Id)),
            EntityStorageShape.File or EntityStorageShape.Archive => Path.Combine(
                targetContainer,
                SafePathSegment(entity.Title, entity.Id) + Path.GetExtension(sourcePath)),
            _ => sourcePath
        };

        var status = SamePath(sourcePath, targetPath) ? Unchanged : Ready;
        var item = NewItem(entity, storageShape, sourcePath, Normalize(targetPath), status, null);
        memo[entityId] = item;
        return item;
    }

    private static string? ResolveTargetContainer(
        EntityRow entity,
        IReadOnlyDictionary<Guid, EntityRow> entityById,
        IReadOnlyDictionary<Guid, EntityFileRow> sourceByEntityId,
        IReadOnlyList<(Guid Id, string Path)> rootPaths,
        IDictionary<Guid, OrganizePlanItemResult?> memo)
    {
        if (entity.ParentEntityId is { } parentId &&
            entityById.TryGetValue(parentId, out var parent) &&
            EntityKindRegistry.TryGet(parent.KindCode, out var parentKind))
        {
            var parentMetadata = EntityKindMetadataRegistry.Require(parentKind);
            var parentItem = BuildItem(parentId, entityById, sourceByEntityId, rootPaths, memo);
            if (parentItem is null)
            {
                return null;
            }

            return parentMetadata.StorageShape == EntityStorageShape.Folder
                ? parentItem.TargetPath
                : Path.GetDirectoryName(parentItem.TargetPath);
        }

        if (!sourceByEntityId.TryGetValue(entity.Id, out var sourceFile))
        {
            return null;
        }

        var sourcePath = Normalize(sourceFile.Path);
        var root = rootPaths.FirstOrDefault(rootPath => IsSubPathOf(sourcePath, rootPath.Path) || SamePath(sourcePath, rootPath.Path));
        return root.Path;
    }

    private static OrganizePlanItemResult NewItem(
        EntityRow entity,
        EntityStorageShape storageShape,
        string sourcePath,
        string targetPath,
        string status,
        string? reason) =>
        new(
            entity.Id,
            entity.KindCode,
            entity.Title,
            storageShape.ToCode(),
            sourcePath,
            targetPath,
            status,
            reason);

    private async Task UpdateMovedPathPrefixesAsync(
        string sourcePath,
        string targetPath,
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var sourceFiles = await db.EntityFiles
            .Where(file => file.Role == EntityFileRole.Source)
            .ToArrayAsync(cancellationToken);
        foreach (var sourceFile in sourceFiles)
        {
            if (TryMapMovedPath(sourceFile.Path, sourcePath, targetPath, out var nextPath))
            {
                sourceFile.Path = nextPath;
                sourceFile.UpdatedAt = now;
            }
        }

        var folderSources = await db.EntitySources
            .ToArrayAsync(cancellationToken);
        foreach (var source in folderSources)
        {
            if (TryMapMovedPath(source.Value, sourcePath, targetPath, out var nextPath))
            {
                source.Value = nextPath;
                source.UpdatedAt = now;
            }
        }
    }

    private static void MoveSource(string sourcePath, string targetPath)
    {
        if (SamePath(sourcePath, targetPath))
        {
            return;
        }

        var parent = Path.GetDirectoryName(targetPath);
        if (!string.IsNullOrWhiteSpace(parent))
        {
            Directory.CreateDirectory(parent);
        }

        if (File.Exists(targetPath) || Directory.Exists(targetPath))
        {
            throw new IOException($"Target path already exists: {targetPath}");
        }

        if (Directory.Exists(sourcePath))
        {
            Directory.Move(sourcePath, targetPath);
            return;
        }

        if (File.Exists(sourcePath))
        {
            File.Move(sourcePath, targetPath);
            return;
        }

        throw new IOException($"Source path does not exist: {sourcePath}");
    }

    private static string SafePathSegment(string title, Guid entityId)
    {
        var invalid = Path.GetInvalidFileNameChars().ToHashSet();
        var cleaned = new string(title
            .Select(character => invalid.Contains(character) ? '_' : character)
            .ToArray()).Trim();
        return string.IsNullOrWhiteSpace(cleaned)
            ? entityId.ToString("N")
            : cleaned;
    }

    private static string Normalize(string path) => Path.GetFullPath(path);

    private static bool TryMapMovedPath(
        string currentPath,
        string sourcePath,
        string targetPath,
        out string mappedPath)
    {
        var normalizedCurrent = Normalize(currentPath);
        var normalizedSource = Normalize(sourcePath);
        if (SamePath(normalizedCurrent, normalizedSource))
        {
            mappedPath = Normalize(targetPath);
            return true;
        }

        if (IsSubPathOf(normalizedCurrent, normalizedSource))
        {
            var relativePath = Path.GetRelativePath(normalizedSource, normalizedCurrent);
            mappedPath = Normalize(Path.Combine(targetPath, relativePath));
            return true;
        }

        mappedPath = currentPath;
        return false;
    }

    private static bool SamePath(string left, string right) =>
        string.Equals(
            Path.TrimEndingDirectorySeparator(Normalize(left)),
            Path.TrimEndingDirectorySeparator(Normalize(right)),
            StringComparison.OrdinalIgnoreCase);

    private static bool IsSubPathOf(string path, string parent)
    {
        var fullPath = Path.TrimEndingDirectorySeparator(Normalize(path));
        var fullParent = Path.TrimEndingDirectorySeparator(Normalize(parent));
        return fullPath.StartsWith(fullParent + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase);
    }
}
