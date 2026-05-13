using System.IO.Compression;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Obscura.Application.Jobs.Ports;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Handlers;

/// <summary>
/// Discovers comic book archives (CBZ/CBR/ZIP), creates book/chapter/page entities,
/// and chains downstream thumbnail jobs for pages.
/// </summary>
public sealed class ScanBookJobHandler(
    ILogger<ScanBookJobHandler> logger,
    IFileDiscovery fileDiscovery,
    ILibraryScanPersistence persistence) : IJobHandler
{
    private static readonly HashSet<string> ImageExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff", ".tif"
    };

    public JobType Type => JobType.ScanBook;

    public async Task HandleAsync(JobContext context, CancellationToken cancellationToken)
    {
        var rootId = ParseRootId(context.Job.PayloadJson);
        if (rootId is null)
        {
            var roots = await persistence.GetEnabledRootsAsync(cancellationToken);
            var bookRoots = roots.Where(r => r.ScanBooks).ToList();
            logger.LogInformation("ScanBook: scanning {Count} book-enabled roots", bookRoots.Count);

            for (var i = 0; i < bookRoots.Count; i++)
            {
                await ScanRootAsync(context, bookRoots[i], cancellationToken);
                await context.ReportProgressAsync((i + 1) * 100 / bookRoots.Count,
                    $"Scanned {bookRoots[i].Label}", cancellationToken);
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
        logger.LogInformation("ScanBook: discovering archives in {Path}", root.Path);

        var archiveFiles = await fileDiscovery.DiscoverFilesAsync(
            root.Path, MediaCategory.ComicArchive, root.Recursive, cancellationToken);

        logger.LogInformation("ScanBook: found {Count} archive files in {Label}", archiveFiles.Count, root.Label);

        var settings = await persistence.GetSettingsAsync(cancellationToken);
        var validBookPaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        for (var fileIndex = 0; fileIndex < archiveFiles.Count; fileIndex++)
        {
            var archivePath = archiveFiles[fileIndex];
            var bookTitle = Path.GetFileNameWithoutExtension(archivePath);
            validBookPaths.Add(archivePath);

            var pageMembers = ListImageMembersInZip(archivePath);
            if (pageMembers.Count == 0)
            {
                logger.LogDebug("ScanBook: skipping empty archive {Path}", archivePath);
                continue;
            }

            var bookId = await persistence.UpsertBookAsync(archivePath, bookTitle, root.IsNsfw, cancellationToken);
            var chapterId = await persistence.UpsertBookChapterAsync(archivePath, bookTitle, bookId, pageMembers.Count, cancellationToken);

            for (var i = 0; i < pageMembers.Count; i++)
            {
                var memberPath = pageMembers[i];
                var pagePath = $"{archivePath}::{memberPath}";
                var pageTitle = Path.GetFileNameWithoutExtension(memberPath);

                var pageId = await persistence.UpsertBookPageAsync(pagePath, pageTitle, bookId, chapterId, i, cancellationToken);

                if (settings.AutoGeneratePreview && !await persistence.HasEntityFileAsync(pageId, "thumbnail", cancellationToken))
                {
                    await context.EnqueueIfNeededAsync(new EnqueueJobRequest(
                        JobType.GenerateBookPageThumbnail, TargetEntityKind: "book-page",
                        TargetEntityId: pageId.ToString(), TargetLabel: pageTitle), cancellationToken);
                }
            }

            if (fileIndex % 10 == 0)
            {
                await context.ReportProgressAsync(fileIndex * 80 / archiveFiles.Count,
                    $"Processing {fileIndex}/{archiveFiles.Count}", cancellationToken);
            }
        }

        await persistence.RemoveStaleBooksInRootAsync(root.Id, validBookPaths, cancellationToken);
    }

    private static List<string> ListImageMembersInZip(string archivePath)
    {
        try
        {
            using var archive = ZipFile.OpenRead(archivePath);
            return archive.Entries
                .Where(entry => !string.IsNullOrEmpty(entry.Name)
                    && ImageExtensions.Contains(Path.GetExtension(entry.Name)))
                .OrderBy(entry => entry.FullName, StringComparer.OrdinalIgnoreCase)
                .Select(entry => entry.FullName)
                .ToList();
        }
        catch
        {
            return [];
        }
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
