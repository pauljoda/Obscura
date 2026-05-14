using Obscura.Application.Jobs.Handlers;
using System.IO.Compression;
using Microsoft.Extensions.Logging;
using Obscura.Application.Jobs.Ports;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Handlers.Scan;

/// <summary>
/// Discovers comic book archives (CBZ/CBR/ZIP), creates book/chapter/page entities,
/// and chains downstream thumbnail jobs for pages.
/// </summary>
public sealed class ScanBookJobHandler(
    ILogger<ScanBookJobHandler> logger,
    IFileDiscovery fileDiscovery,
    ILibraryScanPersistence persistence) : ScanJobHandler(logger, fileDiscovery, persistence)
{
    private static readonly HashSet<string> ImageExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff", ".tif"
    };

    public override JobType Type => JobType.ScanBook;

    protected override bool IsEligibleRoot(LibraryRootData root) => root.ScanBooks;

    protected override async Task ScanRootAsync(JobContext context, LibraryRootData root, CancellationToken cancellationToken)
    {
        logger.LogInformation("ScanBook: discovering archives in {Path}", root.Path);

        var archiveFiles = await FileDiscovery.DiscoverFilesAsync(
            root.Path, MediaCategory.ComicArchive, root.Recursive, cancellationToken);

        logger.LogInformation("ScanBook: found {Count} archive files in {Label}", archiveFiles.Count, root.Label);

        var settings = await Persistence.GetSettingsAsync(cancellationToken);
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

            var bookId = await Persistence.UpsertBookAsync(archivePath, bookTitle, root.IsNsfw, cancellationToken);
            var chapterId = await Persistence.UpsertBookChapterAsync(archivePath, bookTitle, bookId, pageMembers.Count, root.IsNsfw, cancellationToken);

            for (var i = 0; i < pageMembers.Count; i++)
            {
                var memberPath = pageMembers[i];
                var pagePath = $"{archivePath}::{memberPath}";
                var pageTitle = Path.GetFileNameWithoutExtension(memberPath);

                var pageId = await Persistence.UpsertBookPageAsync(pagePath, pageTitle, bookId, chapterId, i, root.IsNsfw, cancellationToken);

                if (settings.AutoGeneratePreview && !await Persistence.HasEntityFileAsync(pageId, EntityFileRole.Thumbnail, cancellationToken))
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

        await Persistence.RemoveStaleBooksInRootAsync(root.Id, validBookPaths, cancellationToken);
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
}
