using Obscura.Domain.Registries;
using Obscura.Domain.Media;
using Obscura.Domain.Taxonomy;

namespace Obscura.Domain.Entities;

/// <summary>
/// Discovers and exposes code-defined entity kinds.
/// </summary>
public sealed class EntityKindRegistry : AbstractRegistry<IEntityKind, string>
{
    private static readonly EntityKindRegistry Registry = new();

    private EntityKindRegistry()
        : base(
            typeof(EntityKindRegistry).Assembly,
            kind => kind.Code,
            StringComparer.OrdinalIgnoreCase,
            kinds => kinds.OrderBy(kind => kind.Code, StringComparer.Ordinal))
    {
    }

    /// <summary>Known video entity kind.</summary>
    public static IEntityKind<Video> Video => Require<Video>("video");

    /// <summary>Known video series entity kind.</summary>
    public static IEntityKind<VideoSeries> VideoSeries => Require<VideoSeries>("video-series");

    /// <summary>Known video season structural entity kind.</summary>
    public static IEntityKind<VideoSeason> VideoSeason => Require<VideoSeason>("video-season");

    /// <summary>Known image entity kind.</summary>
    public static IEntityKind<Image> Image => Require<Image>("image");

    /// <summary>Known gallery entity kind.</summary>
    public static IEntityKind<Gallery> Gallery => Require<Gallery>("gallery");

    /// <summary>Known book entity kind.</summary>
    public static IEntityKind<Book> Book => Require<Book>("book");

    /// <summary>Known book volume structural entity kind.</summary>
    public static IEntityKind<BookVolume> BookVolume => Require<BookVolume>("book-volume");

    /// <summary>Known book chapter structural entity kind.</summary>
    public static IEntityKind<BookChapter> BookChapter => Require<BookChapter>("book-chapter");

    /// <summary>Known book page structural entity kind.</summary>
    public static IEntityKind<BookPage> BookPage => Require<BookPage>("book-page");

    /// <summary>Known generic audio entity kind.</summary>
    public static IEntityKind<Entity> Audio => Require<Entity>("audio");

    /// <summary>Known audio library entity kind.</summary>
    public static IEntityKind<AudioLibrary> AudioLibrary => Require<AudioLibrary>("audio-library");

    /// <summary>Known audio track entity kind.</summary>
    public static IEntityKind<AudioTrack> AudioTrack => Require<AudioTrack>("audio-track");

    /// <summary>Known person taxonomy entity kind.</summary>
    public static IEntityKind<Person> Person => Require<Person>("person");

    /// <summary>Known studio taxonomy entity kind.</summary>
    public static IEntityKind<Studio> Studio => Require<Studio>("studio");

    /// <summary>Known tag taxonomy entity kind.</summary>
    public static IEntityKind<Tag> Tag => Require<Tag>("tag");

    /// <summary>Known collection entity kind.</summary>
    public static IEntityKind<Collection> Collection => Require<Collection>("collection");

    /// <summary>
    /// Gets every known entity kind in deterministic registry order.
    /// </summary>
    public static IReadOnlyList<IEntityKind> All => Registry.Items;

    /// <summary>
    /// Looks up an entity kind by its stable code.
    /// </summary>
    /// <param name="code">Kind code from storage, a route, or an API filter.</param>
    /// <param name="kind">The matched kind when the method returns true.</param>
    /// <returns>True when the code is known; otherwise false.</returns>
    public static bool TryGet(string? code, out IEntityKind kind)
        => Registry.TryGetKey(code, out kind);

    /// <summary>
    /// Looks up an entity kind by its stable code and fails when storage contains an unknown kind.
    /// </summary>
    /// <param name="code">Kind code from storage.</param>
    /// <returns>The registered entity kind.</returns>
    /// <exception cref="InvalidOperationException">Thrown when the kind code is not registered.</exception>
    public static IEntityKind Require(string code)
        => Registry.RequireKey(code, missingCode =>
            $"Unknown entity kind code '{missingCode}'. Add an {nameof(IEntityKind)} implementation before using it.");

    /// <summary>
    /// Looks up an entity kind by code and returns a typed view for child and route access.
    /// </summary>
    /// <typeparam name="TEntity">Entity shape represented by the kind.</typeparam>
    /// <param name="code">Kind code from storage.</param>
    /// <returns>Typed view over the registered entity kind.</returns>
    public static IEntityKind<TEntity> Require<TEntity>(string code)
        where TEntity : Entity =>
        Require(code) is IEntityKind<TEntity> typedKind
            ? typedKind
            : throw new InvalidOperationException($"Entity kind code '{code}' is not registered for {typeof(TEntity).Name}.");
}
