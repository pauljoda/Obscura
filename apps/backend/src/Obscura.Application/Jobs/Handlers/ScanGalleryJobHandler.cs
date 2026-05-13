using System.Text.Json;
using Microsoft.Extensions.Logging;
using Obscura.Application.Jobs.Ports;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Handlers;

/// <summary>
/// Discovers image files organized by directory, creates gallery and image entities,
/// and chains downstream thumbnail/fingerprint jobs.
/// </summary>
public sealed class ScanGalleryJobHandler(
    ILogger<ScanGalleryJobHandler> logger,
    IFileDiscovery fileDiscovery,
    ILibraryScanPersistence persistence) : IJobHandler
{
    public JobType Type => JobType.ScanGallery;

    public async Task HandleAsync(JobContext context, CancellationToken cancellationToken)
    {
        var rootId = ParseRootId(context.Job.PayloadJson);
        if (rootId is null)
        {
            var roots = await persistence.GetEnabledRootsAsync(cancellationToken);
            var imageRoots = roots.Where(r => r.ScanImages).ToList();
            logger.LogInformation("ScanGallery: scanning {Count} image-enabled roots", imageRoots.Count);

            for (var i = 0; i < imageRoots.Count; i++)
            {
                await ScanRootAsync(context, imageRoots[i], cancellationToken);
                await context.ReportProgressAsync((i + 1) * 100 / imageRoots.Count,
                    $"Scanned {imageRoots[i].Label}", cancellationToken);
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
        logger.LogInformation("ScanGallery: discovering images in {Path}", root.Path);

        var dirGroups = await fileDiscovery.DiscoverFilesByDirectoryAsync(
            root.Path, MediaCategory.Image, root.Recursive, cancellationToken);

        logger.LogInformation("ScanGallery: found {DirCount} directories with images in {Label}",
            dirGroups.Count, root.Label);

        var settings = await persistence.GetSettingsAsync(cancellationToken);
        var validGalleryPaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var processedDirs = 0;

        foreach (var (dirPath, imageFiles) in dirGroups)
        {
            var galleryTitle = Path.GetFileName(dirPath);
            validGalleryPaths.Add(dirPath);

            var galleryId = await persistence.UpsertGalleryAsync(dirPath, galleryTitle, root.IsNsfw, cancellationToken);
            var validImagePaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            for (var i = 0; i < imageFiles.Count; i++)
            {
                var filePath = imageFiles[i];
                var title = Path.GetFileNameWithoutExtension(filePath);
                validImagePaths.Add(filePath);

                long? size = null;
                try { size = new FileInfo(filePath).Length; } catch { }

                var imageId = await persistence.UpsertImageAsync(filePath, title, galleryId, size, i, cancellationToken);

                if (settings.AutoGeneratePreview && !await persistence.HasEntityFileAsync(imageId, "thumbnail", cancellationToken))
                {
                    await context.EnqueueIfNeededAsync(new EnqueueJobRequest(
                        JobType.GenerateImageThumbnail, TargetEntityKind: "image",
                        TargetEntityId: imageId.ToString(), TargetLabel: title), cancellationToken);
                }

                if (settings.AutoGenerateFingerprints && !await persistence.HasEntityFingerprintAsync(imageId, "md5", cancellationToken))
                {
                    await context.EnqueueIfNeededAsync(new EnqueueJobRequest(
                        JobType.FingerprintImage, TargetEntityKind: "image",
                        TargetEntityId: imageId.ToString(), TargetLabel: title), cancellationToken);
                }
            }

            await persistence.RemoveStaleImagesInGalleryAsync(galleryId, validImagePaths, cancellationToken);
            processedDirs++;

            if (processedDirs % 10 == 0)
            {
                await context.ReportProgressAsync(processedDirs * 80 / dirGroups.Count,
                    $"Processed {processedDirs}/{dirGroups.Count} directories", cancellationToken);
            }
        }

        await persistence.RemoveStaleGalleriesInRootAsync(root.Id, validGalleryPaths, cancellationToken);
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
