using Obscura.Application.Jobs.Handlers;
using Microsoft.Extensions.Logging;
using Obscura.Application.Jobs.Ports;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Handlers.Scan;

/// <summary>
/// Discovers video files in a configured library root, creates or updates video entities,
/// removes stale entries, and chains downstream probe/fingerprint/preview jobs.
/// Optimized for throughput: batch entity upserts, batch downstream checks, batch job enqueues.
/// </summary>
public sealed class ScanLibraryJobHandler(
    ILogger<ScanLibraryJobHandler> logger,
    IFileDiscovery fileDiscovery,
    ILibraryScanPersistence persistence) : ScanJobHandler(logger, fileDiscovery, persistence)
{
    private const int BatchSize = 50;

    public override JobType Type => JobType.ScanLibrary;

    protected override bool IsEligibleRoot(LibraryRootData root) => root.ScanVideos;

    protected override async Task ScanRootAsync(
        JobContext context, LibraryRootData root, CancellationToken cancellationToken)
    {
        var timer = new JobPhaseTimer();

        IReadOnlyList<string> files;
        using (timer.Phase("discover"))
        {
            logger.LogInformation("ScanLibrary: discovering videos in {Path}", root.Path);
            files = await FileDiscovery.DiscoverFilesAsync(
                root.Path, MediaCategory.Video, root.Recursive, cancellationToken);
            logger.LogInformation("ScanLibrary: found {Count} video files in {Label}", files.Count, root.Label);
        }

        var settings = await Persistence.GetSettingsAsync(cancellationToken);
        var allEntityIds = new List<Guid>(files.Count);
        var validPaths = new HashSet<string>(files.Count, StringComparer.OrdinalIgnoreCase);

        using (timer.Phase("upsert"))
        {
            for (var batchStart = 0; batchStart < files.Count; batchStart += BatchSize)
            {
                var batchEnd = Math.Min(batchStart + BatchSize, files.Count);
                var batchItems = new List<VideoUpsertItem>(batchEnd - batchStart);

                for (var i = batchStart; i < batchEnd; i++)
                {
                    var filePath = files[i];
                    var title = Path.GetFileNameWithoutExtension(filePath);
                    validPaths.Add(filePath);
                    batchItems.Add(new VideoUpsertItem(filePath, title, root.Id, root.IsNsfw));
                }

                var entityIds = await Persistence.UpsertVideosBatchAsync(batchItems, cancellationToken);
                allEntityIds.AddRange(entityIds);

                await context.ReportProgressAsync(
                    batchEnd * 60 / files.Count,
                    $"Upserted {batchEnd}/{files.Count}", cancellationToken);
            }
        }

        using (timer.Phase("enqueue"))
        {
            for (var batchStart = 0; batchStart < allEntityIds.Count; batchStart += BatchSize)
            {
                var batchEnd = Math.Min(batchStart + BatchSize, allEntityIds.Count);
                var batchIds = allEntityIds.GetRange(batchStart, batchEnd - batchStart);

                var needs = await Persistence.CheckDownstreamNeedsBatchAsync(batchIds, cancellationToken);
                var jobRequests = new List<EnqueueJobRequest>();

                for (var i = 0; i < batchIds.Count; i++)
                {
                    var entityId = batchIds[i];
                    var label = Path.GetFileNameWithoutExtension(files[batchStart + i]);
                    var entityIdStr = entityId.ToString();

                    if (!needs.TryGetValue(entityId, out var entityNeeds)) continue;

                    // Priority: probe (30) > fingerprint/subtitle (20) > preview (10)
                    // Probe runs first because preview depends on its technical metadata.
                    if (settings.AutoGenerateMetadata && entityNeeds.NeedsProbe)
                        jobRequests.Add(new EnqueueJobRequest(JobType.ProbeVideo, TargetEntityKind: "video", TargetEntityId: entityIdStr, TargetLabel: label, Priority: 30));

                    if (settings.AutoGenerateFingerprints && entityNeeds.NeedsFingerprint)
                        jobRequests.Add(new EnqueueJobRequest(JobType.FingerprintVideo, TargetEntityKind: "video", TargetEntityId: entityIdStr, TargetLabel: label, Priority: 20));

                    if (entityNeeds.NeedsSubtitleExtraction)
                        jobRequests.Add(new EnqueueJobRequest(JobType.ExtractSubtitles, TargetEntityKind: "video", TargetEntityId: entityIdStr, TargetLabel: label, Priority: 20));

                    var shouldGeneratePreview = settings.AutoGeneratePreview && entityNeeds.NeedsPreview;
                    var shouldGenerateTrickplay = settings.GenerateTrickplay && entityNeeds.NeedsTrickplay;
                    if (shouldGeneratePreview || shouldGenerateTrickplay)
                        jobRequests.Add(new EnqueueJobRequest(JobType.GeneratePreview, TargetEntityKind: "video", TargetEntityId: entityIdStr, TargetLabel: label, Priority: 10));
                }

                if (jobRequests.Count > 0)
                {
                    var enqueued = await context.EnqueueBatchAsync(jobRequests, cancellationToken);
                    logger.LogDebug("ScanLibrary: enqueued {Enqueued}/{Total} downstream jobs for batch", enqueued, jobRequests.Count);
                }

                await context.ReportProgressAsync(
                    60 + (batchEnd * 30 / allEntityIds.Count),
                    $"Enqueued downstream for {batchEnd}/{allEntityIds.Count}", cancellationToken);
            }
        }

        int removed;
        using (timer.Phase("cleanup"))
        {
            removed = await Persistence.RemoveStaleVideosByRootAsync(root.Id, validPaths, cancellationToken);
            if (removed > 0)
                logger.LogInformation("ScanLibrary: removed {Count} stale video entities from {Label}", removed, root.Label);
        }

        await Persistence.UpdateRootLastScannedAsync(root.Id, cancellationToken);

        var report = timer.Finish();
        logger.LogInformation(
            "[METRICS] scan-library {Label} — {FileCount} files, {Removed} stale — {Timing}",
            root.Label, files.Count, removed, report.ToLogString());
    }
}
