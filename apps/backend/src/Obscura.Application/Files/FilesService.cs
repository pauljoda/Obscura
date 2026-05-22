using Obscura.Application.Jobs;
using Obscura.Contracts.Files;
using Obscura.Domain.Entities;

namespace Obscura.Application.Files;

/// <summary>
/// Application service for watched-root filesystem management. It validates root-relative
/// paths, coordinates disk operations through <see cref="IManagedFileStorage"/>, rewrites
/// known catalog source paths after moves, and queues scans for affected roots.
/// </summary>
public sealed class FilesService(
    IFilesPersistence persistence,
    IManagedFileStorage storage,
    IJobQueueService jobs) {
    /// <summary>Lists watched roots available to the Files page.</summary>
    public async Task<FileRootsResponse> ListRootsAsync(CancellationToken cancellationToken) {
        var roots = await persistence.ListRootsAsync(cancellationToken);
        return new FileRootsResponse(roots
            .OrderBy(root => root.Label, StringComparer.OrdinalIgnoreCase)
            .Select(root => new FileRoot(root.Id, root.Label, root.Path, root.Enabled))
            .ToArray());
    }

    /// <summary>Lists direct children under a root-relative directory.</summary>
    public async Task<FileChildrenResponse> ListChildrenAsync(
        FileChildrenRequest request,
        CancellationToken cancellationToken) {
        var directory = await ResolveAsync(request.RootId, request.Path, cancellationToken);
        var entries = await storage.ListChildrenAsync(directory, cancellationToken);
        return new FileChildrenResponse(request.RootId, directory.RelativePath, entries);
    }

    /// <summary>Gets metadata for one watched-root path.</summary>
    public async Task<FileDetail> GetDetailAsync(
        FileDetailRequest request,
        CancellationToken cancellationToken) {
        var path = await ResolveAsync(request.RootId, request.Path, cancellationToken);
        var linked = await persistence.ListLinkedEntitiesAsync(path.AbsolutePath, cancellationToken);
        return await storage.GetDetailAsync(path, linked, cancellationToken);
    }

    /// <summary>Gets content metadata for one previewable file.</summary>
    public async Task<FileContentInfo> GetContentInfoAsync(
        FileDetailRequest request,
        CancellationToken cancellationToken) {
        var path = await ResolveAsync(request.RootId, request.Path, cancellationToken);
        return await storage.GetContentInfoAsync(path, cancellationToken);
    }

    /// <summary>Creates a folder and queues scans for the affected root.</summary>
    public async Task<FileOperationResponse> CreateFolderAsync(
        FileCreateFolderRequest request,
        CancellationToken cancellationToken) {
        var name = CleanSegment(request.Name);
        var relativePath = CombineRelative(NormalizeRelativePath(request.ParentPath), name);
        var target = await ResolveAsync(request.RootId, relativePath, cancellationToken);
        await storage.CreateDirectoryAsync(target, cancellationToken);
        return new FileOperationResponse(await QueueScansAsync([target.Root], cancellationToken));
    }

    /// <summary>Uploads files to a watched-root directory while preserving nested relative paths.</summary>
    public async Task<FileOperationResponse> UploadAsync(
        FileUploadRequest request,
        CancellationToken cancellationToken) {
        if (request.Items.Count == 0) {
            return new FileOperationResponse(0);
        }

        var targetPath = NormalizeRelativePath(request.TargetPath);
        FileLibraryRoot? root = null;
        foreach (var item in request.Items) {
            var relativeItemPath = NormalizeRelativePath(item.RelativePath);
            if (string.IsNullOrWhiteSpace(relativeItemPath)) {
                throw new FileOperationException("invalid_path", "Uploaded files must include a relative path.");
            }

            var destination = await ResolveAsync(
                request.RootId,
                CombineRelative(targetPath, relativeItemPath),
                cancellationToken);
            root = destination.Root;
            await storage.WriteFileAsync(destination, item.Content, cancellationToken);
        }

        return new FileOperationResponse(root is null ? 0 : await QueueScansAsync([root], cancellationToken));
    }

    /// <summary>Renames a file or folder within its current parent directory.</summary>
    public async Task<FileOperationResponse> RenameAsync(
        FileRenameRequest request,
        CancellationToken cancellationToken) {
        var source = await ResolveAsync(request.RootId, request.Path, cancellationToken);
        var parent = Path.GetDirectoryName(source.RelativePath)?.Replace('\\', '/') ?? string.Empty;
        var target = await ResolveAsync(
            request.RootId,
            CombineRelative(parent, CleanSegment(request.Name)),
            cancellationToken);
        await MoveResolvedAsync(source, target, cancellationToken);
        return new FileOperationResponse(await QueueScansAsync([source.Root], cancellationToken));
    }

    /// <summary>Moves a file or folder between watched-root locations.</summary>
    public async Task<FileOperationResponse> MoveAsync(
        FileMoveRequest request,
        CancellationToken cancellationToken) {
        var source = await ResolveAsync(request.SourceRootId, request.SourcePath, cancellationToken);
        var target = await ResolveAsync(request.TargetRootId, request.TargetPath, cancellationToken);
        await MoveResolvedAsync(source, target, cancellationToken);
        return new FileOperationResponse(await QueueScansAsync([source.Root, target.Root], cancellationToken));
    }

    /// <summary>Permanently deletes one watched-root file or directory and queues scans.</summary>
    public async Task<FileOperationResponse> DeleteAsync(
        FileDeleteRequest request,
        CancellationToken cancellationToken) {
        if (string.IsNullOrWhiteSpace(request.Path)) {
            throw new FileOperationException("invalid_path", "Deleting a library root from Files is not supported.");
        }

        var target = await ResolveAsync(request.RootId, request.Path, cancellationToken);
        await storage.DeleteAsync(target, cancellationToken);
        return new FileOperationResponse(await QueueScansAsync([target.Root], cancellationToken));
    }

    /// <summary>Queues scans for one watched root.</summary>
    public async Task<FileOperationResponse> RescanAsync(
        FileRescanRequest request,
        CancellationToken cancellationToken) {
        var root = await GetRootAsync(request.RootId, cancellationToken);
        return new FileOperationResponse(await QueueScansAsync([root], cancellationToken));
    }

    private async Task MoveResolvedAsync(
        ResolvedFilePath source,
        ResolvedFilePath target,
        CancellationToken cancellationToken) {
        await storage.MoveAsync(source, target, cancellationToken);
        await persistence.ApplyPathPrefixRewriteAsync(
            source.AbsolutePath,
            target.AbsolutePath,
            cancellationToken);
    }

    private async Task<ResolvedFilePath> ResolveAsync(
        Guid rootId,
        string? relativePath,
        CancellationToken cancellationToken) {
        var root = await GetRootAsync(rootId, cancellationToken);
        var normalizedRoot = Path.GetFullPath(root.Path);
        var normalizedRelative = NormalizeRelativePath(relativePath);
        if (Path.IsPathRooted(normalizedRelative)) {
            throw new FileOperationException("invalid_path", "Files paths must be relative to a library root.");
        }

        var absolute = string.IsNullOrWhiteSpace(normalizedRelative)
            ? normalizedRoot
            : Path.GetFullPath(Path.Combine(normalizedRoot, normalizedRelative));
        var trimmedRoot = Path.TrimEndingDirectorySeparator(normalizedRoot);
        var trimmedAbsolute = Path.TrimEndingDirectorySeparator(absolute);
        var inside = string.Equals(trimmedRoot, trimmedAbsolute, StringComparison.OrdinalIgnoreCase) ||
            trimmedAbsolute.StartsWith(trimmedRoot + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase);
        if (!inside) {
            throw new FileOperationException("invalid_path", "Files paths cannot escape the selected library root.");
        }

        return new ResolvedFilePath(root, ToRelativePath(normalizedRelative), absolute);
    }

    private async Task<FileLibraryRoot> GetRootAsync(Guid rootId, CancellationToken cancellationToken) {
        var root = await persistence.GetRootAsync(rootId, cancellationToken);
        return root ?? throw new FileOperationException("root_not_found", "Library root was not found.");
    }

    private async Task<int> QueueScansAsync(
        IEnumerable<FileLibraryRoot> roots,
        CancellationToken cancellationToken) {
        var uniqueRoots = roots
            .GroupBy(root => root.Id)
            .Select(group => group.First())
            .Where(root => root.Enabled)
            .ToArray();
        var queued = 0;
        foreach (var root in uniqueRoots) {
            foreach (var type in ScanTypes(root)) {
                var targetId = root.Id.ToString();
                if (await jobs.HasPendingAsync(type, targetId, cancellationToken)) {
                    continue;
                }

                await jobs.EnqueueAsync(new EnqueueJobRequest(
                    Type: type,
                    PayloadJson: new ScanRootPayload(root.Id).ToJson(),
                    TargetEntityKind: "library-root",
                    TargetEntityId: targetId,
                    TargetLabel: root.Label), cancellationToken);
                queued++;
            }
        }

        return queued;
    }

    private static IEnumerable<JobType> ScanTypes(FileLibraryRoot root) {
        if (root.ScanVideos) yield return JobType.ScanLibrary;
        if (root.ScanImages) yield return JobType.ScanGallery;
        if (root.ScanAudio) yield return JobType.ScanAudio;
        if (root.ScanBooks) yield return JobType.ScanBook;
    }

    private static string CleanSegment(string name) {
        var trimmed = name.Trim();
        if (string.IsNullOrWhiteSpace(trimmed) ||
            trimmed is "." or ".." ||
            trimmed.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0 ||
            trimmed.Contains('/') ||
            trimmed.Contains('\\')) {
            throw new FileOperationException("invalid_path", "File or folder names must be valid path segments.");
        }

        return trimmed;
    }

    private static string CombineRelative(string parent, string child) =>
        ToRelativePath(string.IsNullOrWhiteSpace(parent)
            ? child
            : Path.Combine(parent, child));

    private static string NormalizeRelativePath(string? path) =>
        ToRelativePath(path?.Trim() ?? string.Empty);

    private static string ToRelativePath(string path) =>
        path.Replace('\\', '/').Trim('/');
}
