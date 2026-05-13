using Microsoft.Extensions.Logging;
using Obscura.Application.Jobs.Ports;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Handlers;

/// <summary>
/// Discovers video files in a configured library root, creates or updates video entities,
/// removes stale entries, and chains downstream probe/fingerprint/preview jobs.
/// </summary>
public sealed class ScanLibraryJobHandler(
    ILogger<ScanLibraryJobHandler> logger,
    IFileDiscovery fileDiscovery,
    ILibraryScanPersistence persistence) : ScanJobHandler(logger, fileDiscovery, persistence)
{
    public override JobType Type => JobType.ScanLibrary;

    protected override bool IsEligibleRoot(LibraryRootData root) => root.ScanVideos;

    protected override async Task ScanRootAsync(JobContext context, LibraryRootData root, CancellationToken cancellationToken)
    {
        logger.LogInformation("ScanLibrary: discovering videos in {Path}", root.Path);

        var files = await FileDiscovery.DiscoverFilesAsync(root.Path, MediaCategory.Video, root.Recursive, cancellationToken);
        logger.LogInformation("ScanLibrary: found {Count} video files in {Label}", files.Count, root.Label);

        var settings = await Persistence.GetSettingsAsync(cancellationToken);
        var validPaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        for (var i = 0; i < files.Count; i++)
        {
            var filePath = files[i];
            var title = Path.GetFileNameWithoutExtension(filePath);
            validPaths.Add(filePath);

            var entityId = await Persistence.UpsertVideoAsync(filePath, title, root.Id, root.IsNsfw, cancellationToken);
            await EnqueueDownstreamJobsAsync(context, entityId, title, settings, cancellationToken);

            if (i % 50 == 0)
            {
                await context.ReportProgressAsync(i * 80 / files.Count,
                    $"Processing {i}/{files.Count}", cancellationToken);
            }
        }

        var removed = await Persistence.RemoveStaleVideosByRootAsync(root.Id, validPaths, cancellationToken);
        if (removed > 0)
        {
            logger.LogInformation("ScanLibrary: removed {Count} stale video entities from {Label}", removed, root.Label);
        }

        await Persistence.UpdateRootLastScannedAsync(root.Id, cancellationToken);
    }

    private async Task EnqueueDownstreamJobsAsync(
        JobContext context, Guid entityId, string label,
        LibrarySettingsData settings, CancellationToken cancellationToken)
    {
        var entityIdStr = entityId.ToString();

        if (settings.AutoGenerateMetadata && !await Persistence.HasEntityTechnicalAsync(entityId, cancellationToken))
        {
            await context.EnqueueIfNeededAsync(new EnqueueJobRequest(
                JobType.ProbeVideo, TargetEntityKind: "video", TargetEntityId: entityIdStr, TargetLabel: label), cancellationToken);
        }

        if (settings.AutoGenerateFingerprints && !await Persistence.HasEntityFingerprintAsync(entityId, "md5", cancellationToken))
        {
            await context.EnqueueIfNeededAsync(new EnqueueJobRequest(
                JobType.FingerprintVideo, TargetEntityKind: "video", TargetEntityId: entityIdStr, TargetLabel: label), cancellationToken);
        }

        if (settings.AutoGeneratePreview && !await Persistence.HasEntityFileAsync(entityId, "thumbnail", cancellationToken))
        {
            await context.EnqueueIfNeededAsync(new EnqueueJobRequest(
                JobType.GeneratePreview, TargetEntityKind: "video", TargetEntityId: entityIdStr, TargetLabel: label), cancellationToken);
        }

        if (!await Persistence.HasSubtitlesExtractedAsync(entityId, cancellationToken))
        {
            await context.EnqueueIfNeededAsync(new EnqueueJobRequest(
                JobType.ExtractSubtitles, TargetEntityKind: "video", TargetEntityId: entityIdStr, TargetLabel: label), cancellationToken);
        }
    }
}
