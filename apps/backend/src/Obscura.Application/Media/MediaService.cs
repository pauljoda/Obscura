using Obscura.Application.Entities;
using Obscura.Application.Mapping;
using Obscura.Application.Settings;
using Obscura.Contracts.Media;
using Obscura.Domain.Entities;
using Obscura.Domain.Interfaces;

namespace Obscura.Application.Media;

/// <summary>
/// Application use-case service for image, gallery, book, and audio browsing/detail expansion.
/// </summary>
public sealed class MediaService
{
    private readonly IEntityCatalog _entities;
    private readonly IEntityDetails _details;
    private readonly ISettingsService _settings;

    /// <summary>
    /// Creates a media service over shared entity read ports.
    /// </summary>
    /// <param name="entities">Catalog used to list media entities and ordered child links.</param>
    /// <param name="details">Detail reader used to hydrate typed media aggregates.</param>
    /// <param name="settings">Server-side settings used to enforce visibility before contracts are serialized.</param>
    public MediaService(IEntityCatalog entities, IEntityDetails details, ISettingsService settings)
    {
        _entities = entities;
        _details = details;
        _settings = settings;
    }

    /// <summary>
    /// Lists image cards.
    /// </summary>
    /// <param name="query">List query containing optional search text and cursor.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>API-ready image list response.</returns>
    public Task<MediaListResponse> ListImagesAsync(EntityListQuery query, CancellationToken cancellationToken) =>
        ListAsync(EntityKindRegistry.Image, query, cancellationToken);

    /// <summary>
    /// Lists gallery cards.
    /// </summary>
    /// <param name="query">List query containing optional search text and cursor.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>API-ready gallery list response.</returns>
    public Task<MediaListResponse> ListGalleriesAsync(EntityListQuery query, CancellationToken cancellationToken) =>
        ListAsync(EntityKindRegistry.Gallery, query, cancellationToken);

    /// <summary>
    /// Lists book cards.
    /// </summary>
    /// <param name="query">List query containing optional search text and cursor.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>API-ready book list response.</returns>
    public Task<MediaListResponse> ListBooksAsync(EntityListQuery query, CancellationToken cancellationToken) =>
        ListAsync(EntityKindRegistry.Book, query, cancellationToken);

    /// <summary>
    /// Lists audio-library cards.
    /// </summary>
    /// <param name="query">List query containing optional search text and cursor.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>API-ready audio-library list response.</returns>
    public Task<MediaListResponse> ListAudioLibrariesAsync(EntityListQuery query, CancellationToken cancellationToken) =>
        ListAsync(EntityKindRegistry.AudioLibrary, query, cancellationToken);

    /// <summary>
    /// Lists audio-track cards.
    /// </summary>
    /// <param name="query">List query containing optional search text and cursor.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>API-ready audio-track list response.</returns>
    public Task<MediaListResponse> ListAudioTracksAsync(EntityListQuery query, CancellationToken cancellationToken) =>
        ListAsync(EntityKindRegistry.AudioTrack, query, cancellationToken);

    /// <summary>
    /// Gets one image detail contract.
    /// </summary>
    /// <param name="id">Image entity identifier.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>Image detail contract, or null when missing.</returns>
    public async Task<ImageDetail?> GetImageAsync(Guid id, CancellationToken cancellationToken)
    {
        var image = await _details.GetImageAsync(id, cancellationToken);
        return image is null ? null : ContractMapper.ToImageDetail(image);
    }

    /// <summary>
    /// Gets one gallery detail contract with ordered image children.
    /// </summary>
    /// <param name="id">Gallery entity identifier.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>Gallery detail contract, or null when missing.</returns>
    public async Task<GalleryDetail?> GetGalleryAsync(Guid id, CancellationToken cancellationToken)
    {
        var gallery = await _details.GetGalleryAsync(id, cancellationToken);
        if (gallery is null)
        {
            return null;
        }

        var children = await _entities.ListChildrenAsync(
            id,
            EntityKindRegistry.Image,
            cancellationToken);
        return ContractMapper.ToGalleryDetail(gallery, children);
    }

    /// <summary>
    /// Gets one book detail contract.
    /// </summary>
    /// <param name="id">Book entity identifier.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>Book detail contract, or null when missing.</returns>
    public async Task<BookDetail?> GetBookAsync(Guid id, CancellationToken cancellationToken)
    {
        var book = await _details.GetBookAsync(id, cancellationToken);
        return book is null ? null : ContractMapper.ToBookDetail(book);
    }

    /// <summary>
    /// Gets one audio-library detail contract with ordered track children.
    /// </summary>
    /// <param name="id">Audio library entity identifier.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>Audio library detail contract, or null when missing.</returns>
    public async Task<AudioLibraryDetail?> GetAudioLibraryAsync(Guid id, CancellationToken cancellationToken)
    {
        var library = await _details.GetAudioLibraryAsync(id, cancellationToken);
        if (library is null)
        {
            return null;
        }

        var children = await _entities.ListChildrenAsync(
            id,
            EntityKindRegistry.AudioTrack,
            cancellationToken);
        return ContractMapper.ToAudioLibraryDetail(library, children);
    }

    /// <summary>
    /// Gets one audio-track detail contract.
    /// </summary>
    /// <param name="id">Audio track entity identifier.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>Audio track detail contract, or null when missing.</returns>
    public async Task<AudioTrackDetail?> GetAudioTrackAsync(Guid id, CancellationToken cancellationToken)
    {
        var track = await _details.GetAudioTrackAsync(id, cancellationToken);
        return track is null ? null : ContractMapper.ToAudioTrackDetail(track);
    }

    private async Task<MediaListResponse> ListAsync(
        IEntityKind kind,
        EntityListQuery query,
        CancellationToken cancellationToken)
    {
        var settings = await _settings.GetAsync(cancellationToken);
        var page = await _entities.ListAsync(kind, query.Search, query.Cursor, settings.HideNsfw, cancellationToken);
        return ContractMapper.ToMediaListResponse(page);
    }
}
