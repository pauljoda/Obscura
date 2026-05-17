using Obscura.Contracts.Media;
using Obscura.Domain.Entities;
using DomainEntity = Obscura.Domain.Entities.Entity;
using DomainAudioLibrary = Obscura.Domain.Media.AudioLibrary;
using DomainAudioTrack = Obscura.Domain.Media.AudioTrack;
using DomainBook = Obscura.Domain.Media.Book;
using DomainGallery = Obscura.Domain.Media.Gallery;
using DomainImage = Obscura.Domain.Media.Image;

namespace Obscura.Application.Mapping;

/// <summary>
/// Contains media-specific detail contract mapping for v2 image, gallery, book, and audio routes.
/// </summary>
public static partial class ContractMapper
{
    /// <summary>
    /// Converts an image aggregate into its object-specific detail contract.
    /// </summary>
    /// <param name="image">Domain image aggregate with shared capabilities.</param>
    /// <returns>Image detail contract for API callers.</returns>
    public static ImageDetail ToImageDetail(DomainImage image) =>
        new(
            image.Id,
            image.Kind.Code,
            image.Title,
            image.ParentEntityId,
            image.SortOrder,
            ToEntityCapabilities(image.Capabilities),
            ToEntityChildGroups(image.ChildrenByKind),
            ToEntityRelationshipGroups(image.Relationships));

    /// <summary>
    /// Converts a gallery aggregate and ordered children into its object-specific detail contract.
    /// </summary>
    /// <param name="gallery">Domain gallery aggregate with gallery-only fields.</param>
    /// <param name="children">Projected image children for the gallery.</param>
    /// <returns>Gallery detail contract for API callers.</returns>
    public static GalleryDetail ToGalleryDetail(DomainGallery gallery, IReadOnlyList<DomainEntity> children) =>
        new(
            gallery.Id,
            gallery.Kind.Code,
            gallery.Title,
            gallery.ParentEntityId,
            gallery.SortOrder,
            ToEntityCapabilities(gallery.Capabilities),
            ToEntityChildGroups(children),
            ToEntityRelationshipGroups(gallery.Relationships),
            ToCreditMetadata(gallery),
            gallery.GalleryType.ToCode(),
            gallery.CoverImageId);

    /// <summary>
    /// Converts a book aggregate into its object-specific detail contract.
    /// </summary>
    /// <param name="book">Domain book aggregate with book-only fields and shared capabilities.</param>
    /// <returns>Book detail contract for API callers.</returns>
    public static BookDetail ToBookDetail(DomainBook book) =>
        new(
            book.Id,
            book.Kind.Code,
            book.Title,
            book.ParentEntityId,
            book.SortOrder,
            ToEntityCapabilities(book.Capabilities),
            ToEntityChildGroups(book.ChildrenByKind),
            ToEntityRelationshipGroups(book.Relationships),
            book.BookType.ToCode(),
            book.CoverPageId);

    /// <summary>
    /// Converts an audio library aggregate and ordered track children into its object-specific detail contract.
    /// </summary>
    /// <param name="library">Domain audio library aggregate with hierarchy metadata.</param>
    /// <param name="children">Projected audio track children for the library.</param>
    /// <returns>Audio library detail contract for API callers.</returns>
    public static AudioLibraryDetail ToAudioLibraryDetail(DomainAudioLibrary library, IReadOnlyList<DomainEntity> children) =>
        new(
            library.Id,
            library.Kind.Code,
            library.Title,
            library.ParentEntityId,
            library.SortOrder,
            ToEntityCapabilities(library.Capabilities),
            ToEntityChildGroups(children),
            ToEntityRelationshipGroups(library.Relationships));

    /// <summary>
    /// Converts an audio track aggregate into its object-specific detail contract.
    /// </summary>
    /// <param name="track">Domain audio track aggregate with embedded tag metadata.</param>
    /// <returns>Audio track detail contract for API callers.</returns>
    public static AudioTrackDetail ToAudioTrackDetail(DomainAudioTrack track) =>
        new(
            track.Id,
            track.Kind.Code,
            track.Title,
            track.ParentEntityId,
            track.SortOrder,
            ToEntityCapabilities(track.Capabilities),
            ToEntityChildGroups(track.ChildrenByKind),
            ToEntityRelationshipGroups(track.Relationships),
            track.EmbeddedArtist,
            track.EmbeddedAlbum);
}
