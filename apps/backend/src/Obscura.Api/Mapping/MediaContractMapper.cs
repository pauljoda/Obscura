using Obscura.Contracts.Media;
using Obscura.Domain.Entities;
using DomainEntity = Obscura.Domain.Entities.Entity;
using DomainAudioLibrary = Obscura.Domain.Media.AudioLibrary;
using DomainAudioTrack = Obscura.Domain.Media.AudioTrack;
using DomainBook = Obscura.Domain.Media.Book;
using DomainGallery = Obscura.Domain.Media.Gallery;
using DomainImage = Obscura.Domain.Media.Image;

namespace Obscura.Api.Mapping;

public static partial class ContractMapper
{
    public static ImageDetail ToImageDetail(DomainImage image) =>
        new(
            image.Id,
            image.Kind.Code,
            image.Title,
            ToEntityCapabilities(image.Capabilities));

    public static GalleryDetail ToGalleryDetail(DomainGallery gallery, IReadOnlyList<DomainEntity> children) =>
        new(
            gallery.Id,
            gallery.Kind.Code,
            gallery.Title,
            ToEntityCapabilities(gallery.Capabilities),
            ToEntityCards(children),
            gallery.GalleryType.ToCode(),
            gallery.CoverImageId);

    public static BookDetail ToBookDetail(DomainBook book) =>
        new(
            book.Id,
            book.Kind.Code,
            book.Title,
            ToEntityCapabilities(book.Capabilities),
            book.BookType.ToCode(),
            book.CoverPageId);

    public static AudioLibraryDetail ToAudioLibraryDetail(DomainAudioLibrary library, IReadOnlyList<DomainEntity> children) =>
        new(
            library.Id,
            library.Kind.Code,
            library.Title,
            ToEntityCapabilities(library.Capabilities),
            ToEntityCards(children),
            library.ParentLibraryId);

    public static AudioTrackDetail ToAudioTrackDetail(DomainAudioTrack track) =>
        new(
            track.Id,
            track.Kind.Code,
            track.Title,
            ToEntityCapabilities(track.Capabilities),
            track.EmbeddedArtist,
            track.EmbeddedAlbum);
}
