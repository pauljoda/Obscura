namespace Obscura.Domain.Entities;

/// <summary>
/// Discovers and exposes code-defined entity kinds.
/// </summary>
public static class EntityKindRegistry
{
    private static readonly Lazy<IReadOnlyList<IEntityKind>> DiscoveredKinds = new(DiscoverKinds);

    private static readonly Lazy<IReadOnlyDictionary<string, IEntityKind>> ByCode = new(() => All.ToDictionary(
        kind => kind.Code,
        StringComparer.OrdinalIgnoreCase));

    /// <summary>Known video entity kind.</summary>
    public static IEntityKind Video => Require("video");

    /// <summary>Known video series entity kind.</summary>
    public static IEntityKind VideoSeries => Require("video-series");

    /// <summary>Known video season structural entity kind.</summary>
    public static IEntityKind VideoSeason => Require("video-season");

    /// <summary>Known image entity kind.</summary>
    public static IEntityKind Image => Require("image");

    /// <summary>Known gallery entity kind.</summary>
    public static IEntityKind Gallery => Require("gallery");

    /// <summary>Known book entity kind.</summary>
    public static IEntityKind Book => Require("book");

    /// <summary>Known book volume structural entity kind.</summary>
    public static IEntityKind BookVolume => Require("book-volume");

    /// <summary>Known book chapter structural entity kind.</summary>
    public static IEntityKind BookChapter => Require("book-chapter");

    /// <summary>Known book page structural entity kind.</summary>
    public static IEntityKind BookPage => Require("book-page");

    /// <summary>Known generic audio entity kind.</summary>
    public static IEntityKind Audio => Require("audio");

    /// <summary>Known audio library entity kind.</summary>
    public static IEntityKind AudioLibrary => Require("audio-library");

    /// <summary>Known audio track entity kind.</summary>
    public static IEntityKind AudioTrack => Require("audio-track");

    /// <summary>Known person taxonomy entity kind.</summary>
    public static IEntityKind Person => Require("person");

    /// <summary>Known studio taxonomy entity kind.</summary>
    public static IEntityKind Studio => Require("studio");

    /// <summary>Known tag taxonomy entity kind.</summary>
    public static IEntityKind Tag => Require("tag");

    /// <summary>Known collection entity kind.</summary>
    public static IEntityKind Collection => Require("collection");

    /// <summary>
    /// Gets every known entity kind in deterministic registry order.
    /// </summary>
    public static IReadOnlyList<IEntityKind> All => DiscoveredKinds.Value;

    /// <summary>
    /// Looks up an entity kind by its stable code.
    /// </summary>
    /// <param name="code">Kind code from storage, a route, or an API filter.</param>
    /// <param name="kind">The matched kind when the method returns true.</param>
    /// <returns>True when the code is known; otherwise false.</returns>
    public static bool TryGet(string? code, out IEntityKind kind)
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
    public static IEntityKind Require(string code)
    {
        if (TryGet(code, out var kind))
        {
            return kind;
        }

        throw new InvalidOperationException($"Unknown entity kind code '{code}'. Add an {nameof(IEntityKind)} implementation before using it.");
    }

    private static IReadOnlyList<IEntityKind> DiscoverKinds() =>
        typeof(EntityKindRegistry)
            .Assembly
            .GetTypes()
            .Where(type =>
                !type.IsAbstract &&
                !type.IsInterface &&
                typeof(IEntityKind).IsAssignableFrom(type) &&
                type.GetConstructor(Type.EmptyTypes) is not null)
            .Select(type => (IEntityKind)Activator.CreateInstance(type)!)
            .OrderBy(kind => kind.Code, StringComparer.Ordinal)
            .ToArray();
}
