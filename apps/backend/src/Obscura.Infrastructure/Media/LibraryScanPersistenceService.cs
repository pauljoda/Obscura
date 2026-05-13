using Microsoft.EntityFrameworkCore;
using Obscura.Application.Jobs.Ports;
using Obscura.Domain.Entities;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Media;

/// <summary>
/// Implements entity persistence operations for library scanning against the v2 schema.
/// </summary>
public sealed class LibraryScanPersistenceService(ObscuraDbContext db) : ILibraryScanPersistence
{
    // ── Library roots & settings ──

    public async Task<LibraryRootData?> GetLibraryRootAsync(Guid rootId, CancellationToken cancellationToken)
    {
        var row = await db.LibraryRoots.AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == rootId, cancellationToken);
        return row is null ? null : ToData(row);
    }

    public async Task<IReadOnlyList<LibraryRootData>> GetEnabledRootsAsync(CancellationToken cancellationToken)
    {
        return await db.LibraryRoots.AsNoTracking()
            .Where(r => r.Enabled)
            .Select(r => ToData(r))
            .ToListAsync(cancellationToken);
    }

    public async Task<LibrarySettingsData> GetSettingsAsync(CancellationToken cancellationToken)
    {
        var row = await db.LibrarySettings.AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);
        if (row is null)
        {
            return new LibrarySettingsData(true, true, false, true, true, 10, 8, 2, 2);
        }

        return new LibrarySettingsData(
            row.AutoGenerateMetadata,
            row.AutoGenerateFingerprints,
            row.GeneratePhash,
            row.AutoGeneratePreview,
            row.GenerateTrickplay,
            row.TrickplayIntervalSeconds,
            row.PreviewClipDurationSeconds,
            row.ThumbnailQuality,
            row.TrickplayQuality);
    }

    public async Task UpdateRootLastScannedAsync(Guid rootId, CancellationToken cancellationToken)
    {
        var row = await db.LibraryRoots.FindAsync([rootId], cancellationToken);
        if (row is not null)
        {
            row.LastScannedAt = DateTimeOffset.UtcNow;
            row.UpdatedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(cancellationToken);
        }
    }

    // ── Entity upsert ──

    public async Task<Guid> UpsertVideoAsync(string filePath, string title, Guid libraryRootId, bool isNsfw, CancellationToken cancellationToken)
    {
        var existing = await FindEntityBySourcePath(EntityKindRegistry.Video.Code, filePath, cancellationToken);
        if (existing is not null)
        {
            existing.UpdatedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(cancellationToken);
            return existing.Id;
        }

        var now = DateTimeOffset.UtcNow;
        var id = Guid.NewGuid();

        db.Entities.Add(new EntityRow { Id = id, KindCode = EntityKindRegistry.Video.Code, Title = title, CreatedAt = now, UpdatedAt = now });
        db.VideoDetails.Add(new VideoDetailRow { EntityId = id, LibraryRootId = libraryRootId });
        db.EntityFiles.Add(new EntityFileRow
        {
            Id = Guid.NewGuid(), EntityId = id, Role = EntityFileRole.Source,
            Path = filePath, SizeBytes = TryGetFileSize(filePath), CreatedAt = now, UpdatedAt = now
        });
        if (isNsfw)
        {
            db.EntityFlags.Add(new EntityFlagRow { EntityId = id, IsNsfw = true, UpdatedAt = now });
        }

        await db.SaveChangesAsync(cancellationToken);
        return id;
    }

    public async Task<Guid> UpsertImageAsync(string filePath, string title, Guid? galleryEntityId, long? sizeBytes, int sortOrder, CancellationToken cancellationToken)
    {
        var existing = await FindEntityBySourcePath(EntityKindRegistry.Image.Code, filePath, cancellationToken);
        if (existing is not null)
        {
            existing.UpdatedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(cancellationToken);
            return existing.Id;
        }

        var now = DateTimeOffset.UtcNow;
        var id = Guid.NewGuid();

        db.Entities.Add(new EntityRow { Id = id, KindCode = EntityKindRegistry.Image.Code, Title = title, CreatedAt = now, UpdatedAt = now });
        db.ImageDetails.Add(new ImageDetailRow { EntityId = id });
        db.EntityFiles.Add(new EntityFileRow
        {
            Id = Guid.NewGuid(), EntityId = id, Role = EntityFileRole.Source,
            Path = filePath, SizeBytes = sizeBytes, CreatedAt = now, UpdatedAt = now
        });

        if (galleryEntityId is not null)
        {
            db.EntityHierarchyLinks.Add(new EntityHierarchyLinkRow
            {
                ParentEntityId = galleryEntityId.Value, ChildEntityId = id,
                Relationship = EntityRelationshipRegistry.Gallery.Code, SortOrder = sortOrder, CreatedAt = now
            });
        }

        await db.SaveChangesAsync(cancellationToken);
        return id;
    }

    public async Task<Guid> UpsertGalleryAsync(string folderPath, string title, bool isNsfw, CancellationToken cancellationToken)
    {
        var existing = await FindEntityBySourcePath(EntityKindRegistry.Gallery.Code, folderPath, cancellationToken);
        if (existing is not null)
        {
            existing.UpdatedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(cancellationToken);
            return existing.Id;
        }

        var now = DateTimeOffset.UtcNow;
        var id = Guid.NewGuid();

        db.Entities.Add(new EntityRow { Id = id, KindCode = EntityKindRegistry.Gallery.Code, Title = title, CreatedAt = now, UpdatedAt = now });
        db.GalleryDetails.Add(new GalleryDetailRow { EntityId = id, GalleryType = GalleryType.Folder });
        db.EntityFiles.Add(new EntityFileRow
        {
            Id = Guid.NewGuid(), EntityId = id, Role = EntityFileRole.Source,
            Path = folderPath, CreatedAt = now, UpdatedAt = now
        });
        if (isNsfw)
        {
            db.EntityFlags.Add(new EntityFlagRow { EntityId = id, IsNsfw = true, UpdatedAt = now });
        }

        await db.SaveChangesAsync(cancellationToken);
        return id;
    }

    public async Task<Guid> UpsertAudioTrackAsync(string filePath, string title, Guid audioLibraryId, int sortOrder, CancellationToken cancellationToken)
    {
        var existing = await FindEntityBySourcePath(EntityKindRegistry.AudioTrack.Code, filePath, cancellationToken);
        if (existing is not null)
        {
            existing.UpdatedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(cancellationToken);
            return existing.Id;
        }

        var now = DateTimeOffset.UtcNow;
        var id = Guid.NewGuid();

        db.Entities.Add(new EntityRow { Id = id, KindCode = EntityKindRegistry.AudioTrack.Code, Title = title, CreatedAt = now, UpdatedAt = now });
        db.AudioTrackDetails.Add(new AudioTrackDetailRow { EntityId = id });
        db.EntityFiles.Add(new EntityFileRow
        {
            Id = Guid.NewGuid(), EntityId = id, Role = EntityFileRole.Source,
            Path = filePath, SizeBytes = TryGetFileSize(filePath), CreatedAt = now, UpdatedAt = now
        });
        db.EntityHierarchyLinks.Add(new EntityHierarchyLinkRow
        {
            ParentEntityId = audioLibraryId, ChildEntityId = id,
            Relationship = EntityRelationshipRegistry.AudioLibrary.Code, SortOrder = sortOrder, CreatedAt = now
        });

        await db.SaveChangesAsync(cancellationToken);
        return id;
    }

    public async Task<Guid> UpsertAudioLibraryAsync(string folderPath, string title, CancellationToken cancellationToken)
    {
        var existing = await FindEntityBySourcePath(EntityKindRegistry.AudioLibrary.Code, folderPath, cancellationToken);
        if (existing is not null)
        {
            existing.UpdatedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(cancellationToken);
            return existing.Id;
        }

        var now = DateTimeOffset.UtcNow;
        var id = Guid.NewGuid();

        db.Entities.Add(new EntityRow { Id = id, KindCode = EntityKindRegistry.AudioLibrary.Code, Title = title, CreatedAt = now, UpdatedAt = now });
        db.AudioLibraryDetails.Add(new AudioLibraryDetailRow { EntityId = id });
        db.EntityFiles.Add(new EntityFileRow
        {
            Id = Guid.NewGuid(), EntityId = id, Role = EntityFileRole.Source,
            Path = folderPath, CreatedAt = now, UpdatedAt = now
        });

        await db.SaveChangesAsync(cancellationToken);
        return id;
    }

    public async Task<Guid> UpsertBookAsync(string archivePath, string title, bool isNsfw, CancellationToken cancellationToken)
    {
        var existing = await FindEntityBySourcePath(EntityKindRegistry.Book.Code, archivePath, cancellationToken);
        if (existing is not null)
        {
            existing.UpdatedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(cancellationToken);
            return existing.Id;
        }

        var now = DateTimeOffset.UtcNow;
        var id = Guid.NewGuid();

        db.Entities.Add(new EntityRow { Id = id, KindCode = EntityKindRegistry.Book.Code, Title = title, CreatedAt = now, UpdatedAt = now });
        db.BookDetails.Add(new BookDetailRow { EntityId = id, BookType = BookType.Book });
        db.EntityFiles.Add(new EntityFileRow
        {
            Id = Guid.NewGuid(), EntityId = id, Role = EntityFileRole.Source,
            Path = archivePath, SizeBytes = TryGetFileSize(archivePath), CreatedAt = now, UpdatedAt = now
        });
        if (isNsfw)
        {
            db.EntityFlags.Add(new EntityFlagRow { EntityId = id, IsNsfw = true, UpdatedAt = now });
        }

        await db.SaveChangesAsync(cancellationToken);
        return id;
    }

    public async Task<Guid> UpsertBookChapterAsync(string archivePath, string title, Guid bookEntityId, int pageCount, CancellationToken cancellationToken)
    {
        var existing = await FindEntityBySourcePath(EntityKindRegistry.BookChapter.Code, archivePath, cancellationToken);
        if (existing is not null)
        {
            existing.UpdatedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(cancellationToken);
            return existing.Id;
        }

        var now = DateTimeOffset.UtcNow;
        var id = Guid.NewGuid();

        db.Entities.Add(new EntityRow { Id = id, KindCode = EntityKindRegistry.BookChapter.Code, Title = title, CreatedAt = now, UpdatedAt = now });
        db.BookChapterDetails.Add(new BookChapterDetailRow { EntityId = id, BookEntityId = bookEntityId });
        db.EntityFiles.Add(new EntityFileRow
        {
            Id = Guid.NewGuid(), EntityId = id, Role = EntityFileRole.Source,
            Path = archivePath, CreatedAt = now, UpdatedAt = now
        });
        db.EntityHierarchyLinks.Add(new EntityHierarchyLinkRow
        {
            ParentEntityId = bookEntityId, ChildEntityId = id,
            Relationship = EntityRelationshipRegistry.Chapter.Code, SortOrder = 0, CreatedAt = now
        });
        db.EntityCounters.Add(new EntityCounterRow
        {
            EntityId = id, Code = "page_count", Value = pageCount, UpdatedAt = now
        });

        await db.SaveChangesAsync(cancellationToken);
        return id;
    }

    public async Task<Guid> UpsertBookPageAsync(string filePath, string title, Guid bookEntityId, Guid chapterEntityId, int sortOrder, CancellationToken cancellationToken)
    {
        var existing = await FindEntityBySourcePath(EntityKindRegistry.BookPage.Code, filePath, cancellationToken);
        if (existing is not null)
        {
            existing.UpdatedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(cancellationToken);
            return existing.Id;
        }

        var now = DateTimeOffset.UtcNow;
        var id = Guid.NewGuid();

        db.Entities.Add(new EntityRow { Id = id, KindCode = EntityKindRegistry.BookPage.Code, Title = title, CreatedAt = now, UpdatedAt = now });
        db.BookPageDetails.Add(new BookPageDetailRow { EntityId = id, BookEntityId = bookEntityId, ChapterEntityId = chapterEntityId });
        db.EntityFiles.Add(new EntityFileRow
        {
            Id = Guid.NewGuid(), EntityId = id, Role = EntityFileRole.Source,
            Path = filePath, CreatedAt = now, UpdatedAt = now
        });
        db.EntityHierarchyLinks.Add(new EntityHierarchyLinkRow
        {
            ParentEntityId = chapterEntityId, ChildEntityId = id,
            Relationship = EntityRelationshipRegistry.Page.Code, SortOrder = sortOrder, CreatedAt = now
        });

        await db.SaveChangesAsync(cancellationToken);
        return id;
    }

    // ── Stale entity cleanup ──

    public async Task<int> RemoveStaleVideosByRootAsync(Guid rootId, IReadOnlySet<string> validPaths, CancellationToken cancellationToken)
    {
        var videoIds = await db.VideoDetails.AsNoTracking()
            .Where(vd => vd.LibraryRootId == rootId)
            .Select(vd => vd.EntityId)
            .ToListAsync(cancellationToken);

        return await RemoveStaleEntitiesBySourcePath(videoIds, validPaths, cancellationToken);
    }

    public async Task<int> RemoveStaleImagesInGalleryAsync(Guid galleryEntityId, IReadOnlySet<string> validPaths, CancellationToken cancellationToken)
    {
        var childIds = await db.EntityHierarchyLinks.AsNoTracking()
            .Where(link => link.ParentEntityId == galleryEntityId && link.Relationship == EntityRelationshipRegistry.Gallery.Code)
            .Select(link => link.ChildEntityId)
            .ToListAsync(cancellationToken);

        return await RemoveStaleEntitiesBySourcePath(childIds, validPaths, cancellationToken);
    }

    public async Task<int> RemoveStaleGalleriesInRootAsync(Guid rootId, IReadOnlySet<string> validFolderPaths, CancellationToken cancellationToken)
    {
        var galleryIds = await db.Entities.AsNoTracking()
            .Where(e => e.KindCode == EntityKindRegistry.Gallery.Code)
            .Select(e => e.Id)
            .ToListAsync(cancellationToken);

        return await RemoveStaleEntitiesBySourcePath(galleryIds, validFolderPaths, cancellationToken);
    }

    public async Task<int> RemoveStaleAudioTracksInLibraryAsync(Guid libraryEntityId, IReadOnlySet<string> validPaths, CancellationToken cancellationToken)
    {
        var childIds = await db.EntityHierarchyLinks.AsNoTracking()
            .Where(link => link.ParentEntityId == libraryEntityId && link.Relationship == EntityRelationshipRegistry.AudioLibrary.Code)
            .Select(link => link.ChildEntityId)
            .ToListAsync(cancellationToken);

        return await RemoveStaleEntitiesBySourcePath(childIds, validPaths, cancellationToken);
    }

    public async Task<int> RemoveStaleAudioLibrariesInRootAsync(Guid rootId, IReadOnlySet<string> validFolderPaths, CancellationToken cancellationToken)
    {
        var libraryIds = await db.Entities.AsNoTracking()
            .Where(e => e.KindCode == EntityKindRegistry.AudioLibrary.Code)
            .Select(e => e.Id)
            .ToListAsync(cancellationToken);

        return await RemoveStaleEntitiesBySourcePath(libraryIds, validFolderPaths, cancellationToken);
    }

    public async Task<int> RemoveStaleBookChaptersAsync(Guid bookEntityId, IReadOnlySet<string> validArchivePaths, CancellationToken cancellationToken)
    {
        var chapterIds = await db.BookChapterDetails.AsNoTracking()
            .Where(c => c.BookEntityId == bookEntityId)
            .Select(c => c.EntityId)
            .ToListAsync(cancellationToken);

        return await RemoveStaleEntitiesBySourcePath(chapterIds, validArchivePaths, cancellationToken);
    }

    public async Task<int> RemoveStaleBooksInRootAsync(Guid rootId, IReadOnlySet<string> validPaths, CancellationToken cancellationToken)
    {
        var bookIds = await db.Entities.AsNoTracking()
            .Where(e => e.KindCode == EntityKindRegistry.Book.Code)
            .Select(e => e.Id)
            .ToListAsync(cancellationToken);

        return await RemoveStaleEntitiesBySourcePath(bookIds, validPaths, cancellationToken);
    }

    // ── Reads for downstream chaining decisions ──

    public Task<bool> HasEntityTechnicalAsync(Guid entityId, CancellationToken cancellationToken) =>
        db.EntityTechnical.AnyAsync(t => t.EntityId == entityId && t.DurationSeconds != null, cancellationToken);

    public Task<bool> HasEntityFingerprintAsync(Guid entityId, FingerprintAlgorithm algorithm, CancellationToken cancellationToken) =>
        db.EntityFileFingerprints.AnyAsync(f => f.EntityId == entityId && f.Algorithm == algorithm, cancellationToken);

    public Task<bool> HasEntityFileAsync(Guid entityId, EntityFileRole role, CancellationToken cancellationToken) =>
        db.EntityFiles.AnyAsync(f => f.EntityId == entityId && f.Role == role, cancellationToken);

    public async Task<bool> HasSubtitlesExtractedAsync(Guid entityId, CancellationToken cancellationToken)
    {
        var detail = await db.VideoDetails.AsNoTracking()
            .FirstOrDefaultAsync(v => v.EntityId == entityId, cancellationToken);
        return detail?.SubtitlesExtractedAt is not null;
    }

    // ── Entity technical / file / fingerprint writes ──

    public async Task UpsertEntityTechnicalAsync(Guid entityId, double? duration, int? width, int? height,
        double? frameRate, int? bitRate, int? sampleRate, int? channels,
        string? codec, string? container, string? format, CancellationToken cancellationToken)
    {
        var existing = await db.EntityTechnical.FindAsync([entityId], cancellationToken);
        var now = DateTimeOffset.UtcNow;

        if (existing is not null)
        {
            existing.DurationSeconds = duration ?? existing.DurationSeconds;
            existing.Width = width ?? existing.Width;
            existing.Height = height ?? existing.Height;
            existing.FrameRate = frameRate ?? existing.FrameRate;
            existing.BitRate = bitRate ?? existing.BitRate;
            existing.SampleRate = sampleRate ?? existing.SampleRate;
            existing.Channels = channels ?? existing.Channels;
            existing.Codec = codec ?? existing.Codec;
            existing.Container = container ?? existing.Container;
            existing.Format = format ?? existing.Format;
            existing.UpdatedAt = now;
        }
        else
        {
            db.EntityTechnical.Add(new EntityTechnicalRow
            {
                EntityId = entityId, DurationSeconds = duration, Width = width, Height = height,
                FrameRate = frameRate, BitRate = bitRate, SampleRate = sampleRate, Channels = channels,
                Codec = codec, Container = container, Format = format, UpdatedAt = now
            });
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task UpsertEntityFileAsync(Guid entityId, EntityFileRole role, string path, string? mimeType, long? sizeBytes, CancellationToken cancellationToken)
    {
        var existing = await db.EntityFiles
            .FirstOrDefaultAsync(f => f.EntityId == entityId && f.Role == role, cancellationToken);
        var now = DateTimeOffset.UtcNow;

        if (existing is not null)
        {
            existing.Path = path;
            existing.MimeType = mimeType ?? existing.MimeType;
            existing.SizeBytes = sizeBytes ?? existing.SizeBytes;
            existing.UpdatedAt = now;
        }
        else
        {
            db.EntityFiles.Add(new EntityFileRow
            {
                Id = Guid.NewGuid(), EntityId = entityId, Role = role,
                Path = path, MimeType = mimeType, SizeBytes = sizeBytes,
                CreatedAt = now, UpdatedAt = now
            });
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task UpsertEntityFingerprintAsync(Guid entityId, FingerprintAlgorithm algorithm, string value, Guid? entityFileId, CancellationToken cancellationToken)
    {
        var existing = await db.EntityFileFingerprints
            .FirstOrDefaultAsync(f => f.EntityId == entityId && f.Algorithm == algorithm, cancellationToken);

        if (existing is not null)
        {
            existing.Value = value;
            existing.EntityFileId = entityFileId;
        }
        else
        {
            db.EntityFileFingerprints.Add(new EntityFileFingerprintRow
            {
                Id = Guid.NewGuid(), EntityId = entityId, EntityFileId = entityFileId,
                Algorithm = algorithm, Value = value, CreatedAt = DateTimeOffset.UtcNow
            });
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<Guid?> GetSourceFileIdAsync(Guid entityId, CancellationToken cancellationToken)
    {
        return await db.EntityFiles.AsNoTracking()
            .Where(f => f.EntityId == entityId && f.Role == EntityFileRole.Source)
            .Select(f => (Guid?)f.Id)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<string?> GetSourceFilePathAsync(Guid entityId, CancellationToken cancellationToken)
    {
        return await db.EntityFiles.AsNoTracking()
            .Where(f => f.EntityId == entityId && f.Role == EntityFileRole.Source)
            .Select(f => f.Path)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task MarkSubtitlesExtractedAsync(Guid entityId, CancellationToken cancellationToken)
    {
        var detail = await db.VideoDetails.FindAsync([entityId], cancellationToken);
        if (detail is not null)
        {
            detail.SubtitlesExtractedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task UpsertSubtitleAsync(Guid entityId, string language, string? label, string format,
        EntitySubtitleSource source, string storagePath, string sourceFormat, int streamIndex, CancellationToken cancellationToken)
    {
        var langKey = language;

        var existing = await db.EntitySubtitles
            .FirstOrDefaultAsync(s => s.EntityId == entityId && s.Language == langKey
                && s.Source == source, cancellationToken);

        if (existing is not null)
        {
            langKey = $"{language}.{streamIndex}";
            var duplicate = await db.EntitySubtitles
                .AnyAsync(s => s.EntityId == entityId && s.Language == langKey
                    && s.Source == source, cancellationToken);
            if (duplicate)
                return;
        }

        db.EntitySubtitles.Add(new EntitySubtitleRow
        {
            Id = Guid.NewGuid(), EntityId = entityId, Language = langKey, Label = label,
            Format = format, Source = source, StoragePath = storagePath,
            SourceFormat = sourceFormat, SourcePath = streamIndex.ToString(),
            CreatedAt = DateTimeOffset.UtcNow
        });

        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task UpsertAudioTrackTagsAsync(Guid entityId, string? artist, string? album, CancellationToken cancellationToken)
    {
        var detail = await db.AudioTrackDetails.FindAsync([entityId], cancellationToken);
        if (detail is null) return;

        if (artist is not null) detail.EmbeddedArtist = artist;
        if (album is not null) detail.EmbeddedAlbum = album;

        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<EntityTechnicalData?> GetEntityTechnicalAsync(Guid entityId, CancellationToken cancellationToken)
    {
        var row = await db.EntityTechnical.AsNoTracking()
            .FirstOrDefaultAsync(t => t.EntityId == entityId, cancellationToken);
        if (row is null) return null;

        return new EntityTechnicalData(row.DurationSeconds, row.Width, row.Height, row.FrameRate,
            row.BitRate, row.SampleRate, row.Channels, row.Codec, row.Container);
    }

    // ── Helpers ──

    private async Task<EntityRow?> FindEntityBySourcePath(string kindCode, string path, CancellationToken cancellationToken)
    {
        var entityId = await db.EntityFiles.AsNoTracking()
            .Where(f => f.Role == EntityFileRole.Source && f.Path == path)
            .Select(f => (Guid?)f.EntityId)
            .FirstOrDefaultAsync(cancellationToken);

        if (entityId is null) return null;

        return await db.Entities
            .FirstOrDefaultAsync(e => e.Id == entityId.Value && e.KindCode == kindCode, cancellationToken);
    }

    private async Task<int> RemoveStaleEntitiesBySourcePath(
        List<Guid> candidateIds, IReadOnlySet<string> validPaths, CancellationToken cancellationToken)
    {
        if (candidateIds.Count == 0) return 0;

        var sourcePaths = await db.EntityFiles.AsNoTracking()
            .Where(f => candidateIds.Contains(f.EntityId) && f.Role == EntityFileRole.Source)
            .Select(f => new { f.EntityId, f.Path })
            .ToListAsync(cancellationToken);

        var staleIds = sourcePaths
            .Where(sp => !validPaths.Contains(sp.Path))
            .Select(sp => sp.EntityId)
            .ToList();

        if (staleIds.Count == 0) return 0;

        var entitiesToRemove = await db.Entities
            .Where(e => staleIds.Contains(e.Id))
            .ToListAsync(cancellationToken);

        db.Entities.RemoveRange(entitiesToRemove);
        await db.SaveChangesAsync(cancellationToken);

        return entitiesToRemove.Count;
    }

    private static long? TryGetFileSize(string path)
    {
        try { return new FileInfo(path).Length; }
        catch { return null; }
    }

    private static LibraryRootData ToData(LibraryRootRow row) =>
        new(row.Id, row.Path, row.Label, row.Enabled, row.Recursive,
            row.ScanVideos, row.ScanImages, row.ScanAudio, row.ScanBooks, row.IsNsfw);
}
