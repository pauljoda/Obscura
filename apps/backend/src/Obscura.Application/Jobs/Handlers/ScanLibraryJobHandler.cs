using System.Text.Json;
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
    ILibraryScanPersistence persistence) : IJobHandler
{
    public JobType Type => JobType.ScanLibrary;

    public async Task HandleAsync(JobContext context, CancellationToken cancellationToken)
    {
        var rootId = ParseRootId(context.Job.PayloadJson);
        if (rootId is null)
        {
            var roots = await persistence.GetEnabledRootsAsync(cancellationToken);
            var videoRoots = roots.Where(r => r.ScanVideos).ToList();
            logger.LogInformation("ScanLibrary: scanning {Count} video-enabled roots", videoRoots.Count);

            for (var i = 0; i < videoRoots.Count; i++)
            {
                await ScanRootAsync(context, videoRoots[i], cancellationToken);
                await context.ReportProgressAsync((i + 1) * 100 / videoRoots.Count,
                    $"Scanned {videoRoots[i].Label}", cancellationToken);
            }
        }
        else
        {
            var root = await persistence.GetLibraryRootAsync(rootId.Value, cancellationToken);
            if (root is null)
            {
                logger.LogWarning("ScanLibrary: root {RootId} not found", rootId);
                return;
            }

            await ScanRootAsync(context, root, cancellationToken);
            await context.ReportProgressAsync(100, $"Scanned {root.Label}", cancellationToken);
        }
    }

    private async Task ScanRootAsync(JobContext context, LibraryRootData root, CancellationToken cancellationToken)
    {
        logger.LogInformation("ScanLibrary: discovering videos in {Path}", root.Path);

        var files = await fileDiscovery.DiscoverFilesAsync(root.Path, MediaCategory.Video, root.Recursive, cancellationToken);
        logger.LogInformation("ScanLibrary: found {Count} video files in {Label}", files.Count, root.Label);

        var settings = await persistence.GetSettingsAsync(cancellationToken);
        var validPaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        for (var i = 0; i < files.Count; i++)
        {
            var filePath = files[i];
            var title = Path.GetFileNameWithoutExtension(filePath);
            validPaths.Add(filePath);

            var entityId = await persistence.UpsertVideoAsync(filePath, title, root.Id, root.IsNsfw, cancellationToken);
            await EnqueueDownstreamJobsAsync(context, entityId, title, settings, cancellationToken);

            if (i % 50 == 0)
            {
                await context.ReportProgressAsync(i * 80 / files.Count,
                    $"Processing {i}/{files.Count}", cancellationToken);
            }
        }

        var removed = await persistence.RemoveStaleVideosByRootAsync(root.Id, validPaths, cancellationToken);
        if (removed > 0)
        {
            logger.LogInformation("ScanLibrary: removed {Count} stale video entities from {Label}", removed, root.Label);
        }

        await persistence.UpdateRootLastScannedAsync(root.Id, cancellationToken);
    }

    private async Task EnqueueDownstreamJobsAsync(
        JobContext context, Guid entityId, string label,
        LibrarySettingsData settings, CancellationToken cancellationToken)
    {
        var entityIdStr = entityId.ToString();

        if (settings.AutoGenerateMetadata && !await persistence.HasEntityTechnicalAsync(entityId, cancellationToken))
        {
            await context.EnqueueIfNeededAsync(new EnqueueJobRequest(
                JobType.ProbeVideo, TargetEntityKind: "video", TargetEntityId: entityIdStr, TargetLabel: label), cancellationToken);
        }

        if (settings.AutoGenerateFingerprints && !await persistence.HasEntityFingerprintAsync(entityId, "md5", cancellationToken))
        {
            await context.EnqueueIfNeededAsync(new EnqueueJobRequest(
                JobType.FingerprintVideo, TargetEntityKind: "video", TargetEntityId: entityIdStr, TargetLabel: label), cancellationToken);
        }

        if (settings.AutoGeneratePreview && !await persistence.HasEntityFileAsync(entityId, "thumbnail", cancellationToken))
        {
            await context.EnqueueIfNeededAsync(new EnqueueJobRequest(
                JobType.GeneratePreview, TargetEntityKind: "video", TargetEntityId: entityIdStr, TargetLabel: label), cancellationToken);
        }

        if (!await persistence.HasSubtitlesExtractedAsync(entityId, cancellationToken))
        {
            await context.EnqueueIfNeededAsync(new EnqueueJobRequest(
                JobType.ExtractSubtitles, TargetEntityKind: "video", TargetEntityId: entityIdStr, TargetLabel: label), cancellationToken);
        }
    }

    private static Guid? ParseRootId(string? payloadJson)
    {
        if (string.IsNullOrWhiteSpace(payloadJson) || payloadJson == "{}")
            return null;

        try
        {
            using var doc = JsonDocument.Parse(payloadJson);
            if (doc.RootElement.TryGetProperty("rootId", out var prop) && prop.TryGetGuid(out var id))
                return id;
        }
        catch (JsonException) { }

        return null;
    }
}
