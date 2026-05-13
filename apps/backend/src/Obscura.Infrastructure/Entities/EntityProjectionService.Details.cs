using Microsoft.EntityFrameworkCore;
using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;
using Obscura.Domain.Interfaces;
using Obscura.Domain.Media;
using Obscura.Domain.Taxonomy;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Entities;

/// <summary>
/// Hydrates typed media, taxonomy, collection, and structural aggregates from v2 detail rows.
/// </summary>
public sealed partial class EntityProjectionService
{
    /// <summary>
    /// Gets one image aggregate with image-specific detail fields hydrated from v2 storage.
    /// </summary>
    public async Task<Image?> GetImageAggregateAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await GetEntityOfKindAsync(id, EntityKindRegistry.Image, cancellationToken);
        if (entity is null)
        {
            return null;
        }

        var detail = await _db.ImageDetails
            .AsNoTracking()
            .FirstOrDefaultAsync(row => row.EntityId == id, cancellationToken);

        entity = WithDescription(entity, detail?.Details);
        entity = WithDates(entity, [DateValue("captured", detail?.Date)]);
        entity = WithTechnical(entity, null, detail?.Width, detail?.Height, null, null, null, null, null, null, detail?.Format);
        entity = WithSource(entity, [SourceValue("file", detail?.FilePath)]);
        entity = WithPosition(entity, [PositionValue("sort", detail?.SortOrder)]);

        return new Image(entity);
    }

    /// <inheritdoc />
    public Task<Image?> GetImageAsync(Guid id, CancellationToken cancellationToken) =>
        GetImageAggregateAsync(id, cancellationToken);

    /// <summary>
    /// Gets one gallery aggregate with gallery-specific detail fields hydrated from v2 storage.
    /// </summary>
    public async Task<Gallery?> GetGalleryAggregateAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await GetEntityOfKindAsync(id, EntityKindRegistry.Gallery, cancellationToken);
        if (entity is null)
        {
            return null;
        }

        var detail = await _db.GalleryDetails
            .AsNoTracking()
            .FirstOrDefaultAsync(row => row.EntityId == id, cancellationToken);

        entity = WithDescription(entity, detail?.Details);
        entity = WithDates(entity, [DateValue("gallery", detail?.Date)]);
        entity = WithSource(entity, [
            SourceValue("folder", detail?.FolderPath),
            SourceValue("zip", detail?.ZipFilePath)
        ]);
        entity = WithStats(entity, [StatValue("images", detail?.ImageCount)]);

        return new Gallery(
            entity,
            detail?.GalleryType ?? GalleryType.Virtual,
            detail?.CoverImageEntityId);
    }

    /// <inheritdoc />
    public Task<Gallery?> GetGalleryAsync(Guid id, CancellationToken cancellationToken) =>
        GetGalleryAggregateAsync(id, cancellationToken);

    /// <summary>
    /// Gets one book aggregate with book details and single-user read progress.
    /// </summary>
    public async Task<Book?> GetBookAggregateAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await GetEntityOfKindAsync(id, EntityKindRegistry.Book, cancellationToken);
        if (entity is null)
        {
            return null;
        }

        var detail = await _db.BookDetails
            .AsNoTracking()
            .FirstOrDefaultAsync(row => row.EntityId == id, cancellationToken);
        var progress = await _db.BookReadProgress
            .AsNoTracking()
            .FirstOrDefaultAsync(row => row.BookEntityId == id, cancellationToken);

        entity = WithDescription(entity, detail?.Summary);
        entity = WithDates(entity, [DateValue("book", detail?.Date)]);
        entity = WithSource(entity, [
            SourceValue("library-root", detail?.LibraryRootId?.ToString()),
            SourceValue("folder", detail?.FolderPath),
            SourceValue("relative", detail?.RelativePath)
        ]);
        entity = WithStats(entity, [
            StatValue("pages", detail?.PageCount),
            StatValue("chapters", detail?.ChapterCount)
        ]);
        if (progress is not null)
        {
            entity = entity.WithCapability(
                CapabilityRegistry.Progress,
                new CapabilityProgress(
                    progress.ChapterEntityId,
                    "page",
                    progress.PageIndex,
                    progress.PageCount,
                    progress.ReaderMode.ToCode(),
                    progress.CompletedAt,
                    progress.UpdatedAt));
        }

        return new Book(entity, detail?.BookType ?? BookType.Book, detail?.CoverPageEntityId);
    }

    /// <inheritdoc />
    public Task<Book?> GetBookAsync(Guid id, CancellationToken cancellationToken) =>
        GetBookAggregateAsync(id, cancellationToken);

    /// <summary>
    /// Gets one audio library aggregate with audio-library-specific detail fields.
    /// </summary>
    public async Task<AudioLibrary?> GetAudioLibraryAggregateAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await GetEntityOfKindAsync(id, EntityKindRegistry.AudioLibrary, cancellationToken);
        if (entity is null)
        {
            return null;
        }

        var detail = await _db.AudioLibraryDetails
            .AsNoTracking()
            .FirstOrDefaultAsync(row => row.EntityId == id, cancellationToken);

        entity = WithDescription(entity, detail?.Details);
        entity = WithDates(entity, [DateValue("audio-library", detail?.Date)]);
        entity = WithSource(entity, [SourceValue("folder", detail?.FolderPath)]);
        entity = WithStats(entity, [StatValue("tracks", detail?.TrackCount)]);

        return new AudioLibrary(entity, detail?.ParentLibraryEntityId);
    }

    /// <inheritdoc />
    public Task<AudioLibrary?> GetAudioLibraryAsync(Guid id, CancellationToken cancellationToken) =>
        GetAudioLibraryAggregateAsync(id, cancellationToken);

    /// <summary>
    /// Gets one audio track aggregate with technical probe details and playback capability state.
    /// </summary>
    public async Task<AudioTrack?> GetAudioTrackAggregateAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await GetEntityOfKindAsync(id, EntityKindRegistry.AudioTrack, cancellationToken);
        if (entity is null)
        {
            return null;
        }

        var detail = await _db.AudioTrackDetails
            .AsNoTracking()
            .FirstOrDefaultAsync(row => row.EntityId == id, cancellationToken);

        entity = WithDescription(entity, detail?.Details);
        entity = WithDates(entity, [DateValue("audio-track", detail?.Date)]);
        entity = WithTechnical(
            entity,
            detail?.DurationSeconds is null ? null : TimeSpan.FromSeconds(detail.DurationSeconds.Value),
            null,
            null,
            null,
            detail?.BitRate,
            detail?.SampleRate,
            detail?.Channels,
            detail?.Codec,
            detail?.Container,
            null);
        entity = WithPosition(entity, [PositionValue("track", detail?.TrackNumber)]);

        return new AudioTrack(entity, detail?.EmbeddedArtist, detail?.EmbeddedAlbum);
    }

    /// <inheritdoc />
    public Task<AudioTrack?> GetAudioTrackAsync(Guid id, CancellationToken cancellationToken) =>
        GetAudioTrackAggregateAsync(id, cancellationToken);

    /// <summary>
    /// Gets one person taxonomy aggregate with person-specific descriptive detail fields.
    /// </summary>
    public async Task<Person?> GetPersonAggregateAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await GetEntityOfKindAsync(id, EntityKindRegistry.Person, cancellationToken);
        if (entity is null)
        {
            return null;
        }

        var detail = await _db.PersonDetails
            .AsNoTracking()
            .FirstOrDefaultAsync(row => row.EntityId == id, cancellationToken);

        var personEntity = WithDescription(entity, detail?.Details);
        return new Person(
            personEntity.Id,
            personEntity.Title,
            personEntity.Subtitle,
            Disambiguation: detail?.Disambiguation,
            Gender: detail?.Gender,
            Birthdate: detail?.Birthdate,
            Country: detail?.Country,
            Ethnicity: detail?.Ethnicity,
            EyeColor: detail?.EyeColor,
            HairColor: detail?.HairColor,
            Height: detail?.Height,
            Weight: detail?.Weight,
            Measurements: detail?.Measurements,
            Tattoos: detail?.Tattoos,
            Piercings: detail?.Piercings,
            CareerStart: detail?.CareerStart,
            CareerEnd: detail?.CareerEnd,
            capabilities: personEntity.Capabilities);
    }

    /// <inheritdoc />
    public Task<Person?> GetPersonAsync(Guid id, CancellationToken cancellationToken) =>
        GetPersonAggregateAsync(id, cancellationToken);

    /// <summary>
    /// Gets one studio taxonomy aggregate with hierarchy metadata.
    /// </summary>
    public async Task<Studio?> GetStudioAggregateAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await GetEntityOfKindAsync(id, EntityKindRegistry.Studio, cancellationToken);
        if (entity is null)
        {
            return null;
        }

        var detail = await _db.StudioDetails
            .AsNoTracking()
            .FirstOrDefaultAsync(row => row.EntityId == id, cancellationToken);

        return new Studio(
            WithDescription(entity, detail?.Description),
            detail?.ParentStudioEntityId);
    }

    /// <inheritdoc />
    public Task<Studio?> GetStudioAsync(Guid id, CancellationToken cancellationToken) =>
        GetStudioAggregateAsync(id, cancellationToken);

    /// <summary>
    /// Gets one tag taxonomy aggregate with hierarchy and automation metadata.
    /// </summary>
    public async Task<Tag?> GetTagAggregateAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await GetEntityOfKindAsync(id, EntityKindRegistry.Tag, cancellationToken);
        if (entity is null)
        {
            return null;
        }

        var detail = await _db.TagDetails
            .AsNoTracking()
            .FirstOrDefaultAsync(row => row.EntityId == id, cancellationToken);

        return new Tag(
            WithDescription(entity, detail?.Description),
            detail?.ParentTagEntityId,
            detail?.IgnoreAutoTag ?? false);
    }

    /// <inheritdoc />
    public Task<Tag?> GetTagAsync(Guid id, CancellationToken cancellationToken) =>
        GetTagAggregateAsync(id, cancellationToken);

    /// <summary>
    /// Gets one collection aggregate with collection-specific detail fields and ordered member projections.
    /// </summary>
    public async Task<Collection?> GetCollectionAggregateAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await GetEntityOfKindAsync(id, EntityKindRegistry.Collection, cancellationToken);
        if (entity is null)
        {
            return null;
        }

        var detail = await _db.CollectionDetails
            .AsNoTracking()
            .FirstOrDefaultAsync(row => row.EntityId == id, cancellationToken);
        var items = await LoadLinkedChildrenAsync(id, EntityRelationshipRegistry.CollectionItem, null, cancellationToken);

        entity = WithDescription(entity, detail?.Description);
        entity = WithStats(entity, [StatValue("items", detail?.ItemCount)]);

        return new Collection(
            entity,
            detail?.Mode ?? CollectionMode.Manual,
            detail?.RuleTreeJson,
            detail?.CoverMode ?? CollectionCoverMode.Mosaic,
            detail?.CoverItemEntityId,
            TimeSpan.FromSeconds(detail?.SlideshowDurationSeconds ?? 5),
            detail?.SlideshowAutoAdvance ?? true,
            detail?.LastRefreshedAt,
            items);
    }

    /// <inheritdoc />
    public Task<Collection?> GetCollectionAsync(Guid id, CancellationToken cancellationToken) =>
        GetCollectionAggregateAsync(id, cancellationToken);

    /// <summary>
    /// Gets one structural video-season aggregate with season-specific detail fields.
    /// </summary>
    public async Task<VideoSeason?> GetVideoSeasonAggregateAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await GetEntityOfKindAsync(id, EntityKindRegistry.VideoSeason, cancellationToken);
        if (entity is null)
        {
            return null;
        }

        var detail = await _db.VideoSeasonDetails
            .AsNoTracking()
            .FirstOrDefaultAsync(row => row.EntityId == id, cancellationToken);

        entity = WithDescription(entity, detail?.Overview);
        entity = WithSource(entity, [SourceValue("folder", detail?.FolderPath)]);
        entity = WithDates(entity, [DateValue("air", detail?.AirDate)]);
        entity = WithPosition(entity, [PositionValue("season", detail?.SeasonNumber)]);

        return new VideoSeason(entity, detail?.SeriesEntityId ?? Guid.Empty);
    }

    /// <summary>
    /// Gets one structural book-volume aggregate with volume-specific detail fields.
    /// </summary>
    public async Task<BookVolume?> GetBookVolumeAggregateAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await GetEntityOfKindAsync(id, EntityKindRegistry.BookVolume, cancellationToken);
        if (entity is null)
        {
            return null;
        }

        var detail = await _db.BookVolumeDetails
            .AsNoTracking()
            .FirstOrDefaultAsync(row => row.EntityId == id, cancellationToken);

        entity = WithSource(entity, [
            SourceValue("folder", detail?.FolderPath),
            SourceValue("relative", detail?.RelativePath)
        ]);
        entity = WithPosition(entity, [PositionValue("volume", detail?.VolumeNumber)]);

        return new BookVolume(entity, detail?.BookEntityId ?? Guid.Empty);
    }

    /// <summary>
    /// Gets one structural book-chapter aggregate with chapter-specific detail fields.
    /// </summary>
    public async Task<BookChapter?> GetBookChapterAggregateAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await GetEntityOfKindAsync(id, EntityKindRegistry.BookChapter, cancellationToken);
        if (entity is null)
        {
            return null;
        }

        var detail = await _db.BookChapterDetails
            .AsNoTracking()
            .FirstOrDefaultAsync(row => row.EntityId == id, cancellationToken);

        entity = WithSource(entity, [
            SourceValue("archive", detail?.ArchivePath),
            SourceValue("relative", detail?.RelativePath)
        ]);
        entity = WithStats(entity, [StatValue("pages", detail?.PageCount)]);
        entity = WithPosition(entity, [PositionValue("chapter", detail?.ChapterNumber)]);

        return new BookChapter(
            entity,
            detail?.BookEntityId ?? Guid.Empty,
            detail?.VolumeEntityId,
            detail?.CoverPageEntityId);
    }

    /// <summary>
    /// Gets one structural book-page aggregate with page-specific file detail fields.
    /// </summary>
    public async Task<BookPage?> GetBookPageAggregateAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await GetEntityOfKindAsync(id, EntityKindRegistry.BookPage, cancellationToken);
        if (entity is null)
        {
            return null;
        }

        var detail = await _db.BookPageDetails
            .AsNoTracking()
            .FirstOrDefaultAsync(row => row.EntityId == id, cancellationToken);

        entity = WithTechnical(entity, null, detail?.Width, detail?.Height, null, null, null, null, null, null, detail?.Format);
        entity = WithSource(entity, [SourceValue("file", detail?.FilePath)]);
        entity = WithPosition(entity, [PositionValue("sort", detail?.SortOrder)]);

        return new BookPage(entity, detail?.BookEntityId ?? Guid.Empty, detail?.ChapterEntityId ?? Guid.Empty);
    }
}
