namespace Obscura.Domain.Entities;

/// <summary>
/// Code-defined entity kinds that Obscura understands at compile time.
/// </summary>
public enum EntityKindCode
{
    /// <summary>Playable video media.</summary>
    Video,

    /// <summary>Series, season, or other video grouping media.</summary>
    VideoSeries,

    /// <summary>Season or season-like structural grouping inside a video series.</summary>
    VideoSeason,

    /// <summary>Single image media.</summary>
    Image,

    /// <summary>Image gallery media.</summary>
    Gallery,

    /// <summary>Book, comic, or manga media.</summary>
    Book,

    /// <summary>Volume or volume-like structural grouping inside a book.</summary>
    BookVolume,

    /// <summary>Chapter or chapter-like readable unit inside a book.</summary>
    BookChapter,

    /// <summary>Single readable page inside a book chapter.</summary>
    BookPage,

    /// <summary>Generic audio media.</summary>
    Audio,

    /// <summary>Album, audiobook, podcast, or other audio grouping media.</summary>
    AudioLibrary,

    /// <summary>Single audio track media.</summary>
    AudioTrack,

    /// <summary>Person taxonomy entity.</summary>
    Person,

    /// <summary>Studio taxonomy entity.</summary>
    Studio,

    /// <summary>Tag taxonomy entity.</summary>
    Tag,

    /// <summary>User-curated collection entity.</summary>
    Collection
}

/// <summary>
/// Broad grouping used to separate media, taxonomy, collection, and system entities.
/// </summary>
public enum EntityKindCategory
{
    /// <summary>Playable, readable, or viewable library items.</summary>
    Media,

    /// <summary>Descriptive classification entities such as people, studios, and tags.</summary>
    Taxonomy,

    /// <summary>User-curated groupings of other entities.</summary>
    Collection,

    /// <summary>Internal entities that support app behavior rather than library browsing.</summary>
    System
}

/// <summary>
/// Contract implemented by every code-defined entity kind.
/// </summary>
public interface IEntityKind
{
    /// <summary>Compile-time identity for the entity kind.</summary>
    EntityKindCode Value { get; }

    /// <summary>Stable code used in storage, URLs, and API filters.</summary>
    string Code { get; }

    /// <summary>Human-readable label for diagnostics and future UI surfaces.</summary>
    string DisplayName { get; }

    /// <summary>Broad category used for behavior grouping.</summary>
    EntityKindCategory Category { get; }
}

/// <summary>
/// Base class for known entity kinds without coupling domain code to route names or database rows.
/// </summary>
/// <param name="Value">Compile-time identity for the entity kind.</param>
/// <param name="Code">Stable code used in storage, URLs, and API filters.</param>
/// <param name="DisplayName">Human-readable label for diagnostics and future UI surfaces.</param>
/// <param name="Category">Broad category used for behavior grouping.</param>
public abstract record EntityKind(
    EntityKindCode Value,
    string Code,
    string DisplayName,
    EntityKindCategory Category)
    : IEntityKind
{
    private static readonly Lazy<IReadOnlyList<EntityKind>> DiscoveredKinds = new(DiscoverKinds);

    private static readonly Lazy<IReadOnlyDictionary<string, EntityKind>> ByCode = new(() => All.ToDictionary(
        kind => kind.Code,
        StringComparer.OrdinalIgnoreCase));

    private static readonly Lazy<IReadOnlyDictionary<EntityKindCode, EntityKind>> ByValue = new(() => All.ToDictionary(
        kind => kind.Value));

    /// <summary>Known video entity kind.</summary>
    public static EntityKind Video => Require(EntityKindCode.Video);

    /// <summary>Known video series entity kind.</summary>
    public static EntityKind VideoSeries => Require(EntityKindCode.VideoSeries);

    /// <summary>Known video season structural entity kind.</summary>
    public static EntityKind VideoSeason => Require(EntityKindCode.VideoSeason);

    /// <summary>Known image entity kind.</summary>
    public static EntityKind Image => Require(EntityKindCode.Image);

    /// <summary>Known gallery entity kind.</summary>
    public static EntityKind Gallery => Require(EntityKindCode.Gallery);

    /// <summary>Known book entity kind.</summary>
    public static EntityKind Book => Require(EntityKindCode.Book);

    /// <summary>Known book volume structural entity kind.</summary>
    public static EntityKind BookVolume => Require(EntityKindCode.BookVolume);

    /// <summary>Known book chapter structural entity kind.</summary>
    public static EntityKind BookChapter => Require(EntityKindCode.BookChapter);

    /// <summary>Known book page structural entity kind.</summary>
    public static EntityKind BookPage => Require(EntityKindCode.BookPage);

    /// <summary>Known generic audio entity kind.</summary>
    public static EntityKind Audio => Require(EntityKindCode.Audio);

    /// <summary>Known audio library entity kind.</summary>
    public static EntityKind AudioLibrary => Require(EntityKindCode.AudioLibrary);

    /// <summary>Known audio track entity kind.</summary>
    public static EntityKind AudioTrack => Require(EntityKindCode.AudioTrack);

    /// <summary>Known person taxonomy entity kind.</summary>
    public static EntityKind Person => Require(EntityKindCode.Person);

    /// <summary>Known studio taxonomy entity kind.</summary>
    public static EntityKind Studio => Require(EntityKindCode.Studio);

    /// <summary>Known tag taxonomy entity kind.</summary>
    public static EntityKind Tag => Require(EntityKindCode.Tag);

    /// <summary>Known collection entity kind.</summary>
    public static EntityKind Collection => Require(EntityKindCode.Collection);

    /// <summary>
    /// Gets every known entity kind in deterministic registry order.
    /// </summary>
    public static IReadOnlyList<EntityKind> All => DiscoveredKinds.Value;

    /// <summary>
    /// Looks up an entity kind by its stable code.
    /// </summary>
    /// <param name="code">Kind code from storage, a route, or an API filter.</param>
    /// <param name="kind">The matched kind when the method returns true.</param>
    /// <returns>True when the code is known; otherwise false.</returns>
    public static bool TryGet(string? code, out EntityKind kind)
    {
        if (code is not null && ByCode.Value.TryGetValue(code, out var match))
        {
            kind = match;
            return true;
        }

        kind = default!;
        return false;
    }

    /// <summary>
    /// Looks up an entity kind by its stable code and fails when storage contains an unknown kind.
    /// </summary>
    /// <param name="code">Kind code from storage.</param>
    /// <returns>The registered entity kind.</returns>
    /// <exception cref="InvalidOperationException">Thrown when the kind code is not registered.</exception>
    public static EntityKind Require(string code)
    {
        if (TryGet(code, out var kind))
        {
            return kind;
        }

        throw new InvalidOperationException($"Unknown entity kind code '{code}'. Add an {nameof(IEntityKind)} implementation before using it.");
    }

    /// <summary>
    /// Looks up an entity kind by its compile-time identity and fails when it is not registered.
    /// </summary>
    /// <param name="value">Compile-time entity kind identity.</param>
    /// <returns>The registered entity kind.</returns>
    /// <exception cref="InvalidOperationException">Thrown when the kind value is not registered.</exception>
    public static EntityKind Require(EntityKindCode value)
    {
        if (ByValue.Value.TryGetValue(value, out var kind))
        {
            return kind;
        }

        throw new InvalidOperationException($"Unknown entity kind value '{value}'. Add an {nameof(IEntityKind)} implementation before using it.");
    }

    private static IReadOnlyList<EntityKind> DiscoverKinds() =>
        typeof(EntityKind)
            .Assembly
            .GetTypes()
            .Where(type =>
                !type.IsAbstract &&
                !type.IsInterface &&
                typeof(IEntityKind).IsAssignableFrom(type) &&
                type.GetConstructor(Type.EmptyTypes) is not null)
            .Select(type => (EntityKind)Activator.CreateInstance(type)!)
            .OrderBy(kind => kind.Value)
            .ToArray();
}
