namespace Obscura.Domain.Entities;

/// <summary>
/// Discovers and exposes code-defined entity relationships.
/// </summary>
public static class EntityRelationshipRegistry
{
    private static readonly Lazy<IReadOnlyList<IEntityRelationship>> DiscoveredRelationships = new(DiscoverRelationships);

    private static readonly Lazy<IReadOnlyDictionary<string, IEntityRelationship>> ByCode = new(() => All.ToDictionary(
        relationship => relationship.Code,
        StringComparer.OrdinalIgnoreCase));

    /// <summary>Relationship from a video series or season to an episode video.</summary>
    public static IEntityRelationship Episode => Require("episode");

    /// <summary>Relationship from a video series to a season grouping.</summary>
    public static IEntityRelationship Season => Require("season");

    /// <summary>Relationship from a user collection to one of its member entities.</summary>
    public static IEntityRelationship CollectionItem => Require("collection-item");

    /// <summary>Relationship from a gallery to a nested gallery entity.</summary>
    public static IEntityRelationship NestedGallery => Require("nested-gallery");

    /// <summary>Relationship from a gallery to one of its image entities.</summary>
    public static IEntityRelationship GalleryImage => Require("gallery-image");

    /// <summary>Relationship from an audio library to a nested audio library entity.</summary>
    public static IEntityRelationship NestedAudioLibrary => Require("nested-audio-library");

    /// <summary>Relationship from an audio library to one of its track entities.</summary>
    public static IEntityRelationship AudioTrack => Require("audio-track");

    /// <summary>Relationship from a book to a volume grouping.</summary>
    public static IEntityRelationship Volume => Require("volume");

    /// <summary>Relationship from a book or volume to a readable chapter.</summary>
    public static IEntityRelationship Chapter => Require("chapter");

    /// <summary>Relationship from a chapter to a readable page.</summary>
    public static IEntityRelationship Page => Require("page");

    /// <summary>Relationship from a tag to a nested tag.</summary>
    public static IEntityRelationship NestedTag => Require("nested-tag");

    /// <summary>Relationship from a studio to a nested studio.</summary>
    public static IEntityRelationship NestedStudio => Require("nested-studio");

    /// <summary>
    /// Gets every known entity relationship in deterministic registry order.
    /// </summary>
    public static IReadOnlyList<IEntityRelationship> All => DiscoveredRelationships.Value;

    /// <summary>
    /// Gets canonical structural relationships that represent ownership or navigational parentage.
    /// </summary>
    public static IReadOnlyList<IEntityRelationship> Structural => All.Where(relationship => relationship.IsStructural).ToArray();

    /// <summary>
    /// Looks up an entity relationship by its stable code.
    /// </summary>
    /// <param name="code">Relationship code from storage or API input.</param>
    /// <param name="relationship">The matched relationship when the method returns true.</param>
    /// <returns>True when the code is known; otherwise false.</returns>
    public static bool TryGet(string? code, out IEntityRelationship relationship)
    {
        if (code is not null && ByCode.Value.TryGetValue(code, out var match))
        {
            relationship = match;
            return true;
        }

        relationship = default!;
        return false;
    }

    /// <summary>
    /// Looks up a relationship by code and fails when storage contains an unknown relationship.
    /// </summary>
    /// <param name="code">Relationship code from storage.</param>
    /// <returns>The registered entity relationship.</returns>
    /// <exception cref="InvalidOperationException">Thrown when the relationship code is not registered.</exception>
    public static IEntityRelationship Require(string code)
    {
        if (TryGet(code, out var relationship))
        {
            return relationship;
        }

        throw new InvalidOperationException($"Unknown entity relationship code '{code}'. Add an {nameof(IEntityRelationship)} implementation before using it.");
    }

    private static IReadOnlyList<IEntityRelationship> DiscoverRelationships() =>
        typeof(EntityRelationshipRegistry)
            .Assembly
            .GetTypes()
            .Where(type =>
                !type.IsAbstract &&
                !type.IsInterface &&
                typeof(IEntityRelationship).IsAssignableFrom(type) &&
                type.GetConstructor(Type.EmptyTypes) is not null)
            .Select(type => (IEntityRelationship)Activator.CreateInstance(type)!)
            .OrderBy(relationship => relationship.Code, StringComparer.Ordinal)
            .ToArray();
}
