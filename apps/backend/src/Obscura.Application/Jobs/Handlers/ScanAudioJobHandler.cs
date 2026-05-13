using System.Text.Json;
using Microsoft.Extensions.Logging;
using Obscura.Application.Jobs.Ports;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Handlers;

/// <summary>
/// Discovers audio files organized by directory, creates audio library and track entities,
/// and chains downstream probe/fingerprint jobs.
/// </summary>
public sealed class ScanAudioJobHandler(
    ILogger<ScanAudioJobHandler> logger,
    IFileDiscovery fileDiscovery,
    ILibraryScanPersistence persistence) : IJobHandler
{
    public JobType Type => JobType.ScanAudio;

    public async Task HandleAsync(JobContext context, CancellationToken cancellationToken)
    {
        var rootId = ParseRootId(context.Job.PayloadJson);
        if (rootId is null)
        {
            var roots = await persistence.GetEnabledRootsAsync(cancellationToken);
            var audioRoots = roots.Where(r => r.ScanAudio).ToList();
            logger.LogInformation("ScanAudio: scanning {Count} audio-enabled roots", audioRoots.Count);

            for (var i = 0; i < audioRoots.Count; i++)
            {
                await ScanRootAsync(context, audioRoots[i], cancellationToken);
                await context.ReportProgressAsync((i + 1) * 100 / audioRoots.Count,
                    $"Scanned {audioRoots[i].Label}", cancellationToken);
            }
        }
        else
        {
            var root = await persistence.GetLibraryRootAsync(rootId.Value, cancellationToken);
            if (root is null) return;
            await ScanRootAsync(context, root, cancellationToken);
            await context.ReportProgressAsync(100, $"Scanned {root.Label}", cancellationToken);
        }
    }

    private async Task ScanRootAsync(JobContext context, LibraryRootData root, CancellationToken cancellationToken)
    {
        logger.LogInformation("ScanAudio: discovering audio files in {Path}", root.Path);

        var dirGroups = await fileDiscovery.DiscoverFilesByDirectoryAsync(
            root.Path, MediaCategory.Audio, root.Recursive, cancellationToken);

        logger.LogInformation("ScanAudio: found {DirCount} directories with audio in {Label}",
            dirGroups.Count, root.Label);

        var settings = await persistence.GetSettingsAsync(cancellationToken);
        var validLibraryPaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var processedDirs = 0;

        foreach (var (dirPath, audioFiles) in dirGroups)
        {
            var libraryTitle = Path.GetFileName(dirPath);
            validLibraryPaths.Add(dirPath);

            var libraryId = await persistence.UpsertAudioLibraryAsync(dirPath, libraryTitle, cancellationToken);
            var validTrackPaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            for (var i = 0; i < audioFiles.Count; i++)
            {
                var filePath = audioFiles[i];
                var title = Path.GetFileNameWithoutExtension(filePath);
                validTrackPaths.Add(filePath);

                var trackId = await persistence.UpsertAudioTrackAsync(filePath, title, libraryId, i, cancellationToken);

                if (settings.AutoGenerateMetadata && !await persistence.HasEntityTechnicalAsync(trackId, cancellationToken))
                {
                    await context.EnqueueIfNeededAsync(new EnqueueJobRequest(
                        JobType.ProbeAudio, TargetEntityKind: "audio-track",
                        TargetEntityId: trackId.ToString(), TargetLabel: title), cancellationToken);
                }

                if (settings.AutoGenerateFingerprints && !await persistence.HasEntityFingerprintAsync(trackId, "md5", cancellationToken))
                {
                    await context.EnqueueIfNeededAsync(new EnqueueJobRequest(
                        JobType.FingerprintAudio, TargetEntityKind: "audio-track",
                        TargetEntityId: trackId.ToString(), TargetLabel: title), cancellationToken);
                }
            }

            await persistence.RemoveStaleAudioTracksInLibraryAsync(libraryId, validTrackPaths, cancellationToken);
            processedDirs++;

            if (processedDirs % 10 == 0)
            {
                await context.ReportProgressAsync(processedDirs * 80 / dirGroups.Count,
                    $"Processed {processedDirs}/{dirGroups.Count} directories", cancellationToken);
            }
        }

        await persistence.RemoveStaleAudioLibrariesInRootAsync(root.Id, validLibraryPaths, cancellationToken);
    }

    private static Guid? ParseRootId(string? payloadJson)
    {
        if (string.IsNullOrWhiteSpace(payloadJson) || payloadJson == "{}") return null;
        try
        {
            using var doc = JsonDocument.Parse(payloadJson);
            if (doc.RootElement.TryGetProperty("rootId", out var prop) && prop.TryGetGuid(out var id)) return id;
        }
        catch (JsonException) { }
        return null;
    }
}
