using Obscura.Domain.Media;
using Obscura.Domain.Taxonomy;

namespace Obscura.Domain.Interfaces;

/// <summary>
/// Reads typed entity aggregates for detail screens that need flat kind-specific fields beside shared capabilities.
/// </summary>
public interface IEntityDetails
{
    /// <summary>Gets one image aggregate.</summary>
    Task<Image?> GetImageAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Gets one gallery aggregate.</summary>
    Task<Gallery?> GetGalleryAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Gets one book aggregate.</summary>
    Task<Book?> GetBookAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Gets one audio library aggregate.</summary>
    Task<AudioLibrary?> GetAudioLibraryAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Gets one audio track aggregate.</summary>
    Task<AudioTrack?> GetAudioTrackAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Gets one person aggregate.</summary>
    Task<Person?> GetPersonAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Gets one studio aggregate.</summary>
    Task<Studio?> GetStudioAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Gets one tag aggregate.</summary>
    Task<Tag?> GetTagAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Gets one collection aggregate.</summary>
    Task<Collection?> GetCollectionAsync(Guid id, CancellationToken cancellationToken);
}
