using Obscura.Domain.Registries;

namespace Obscura.Domain.Entities;

/// <summary>
/// Discovers and exposes code-defined entity relationships.
/// </summary>
public sealed class EntityRelationshipRegistry : AbstractRegistry<IEntityRelationship, string>
{
    private static readonly EntityRelationshipRegistry Registry = new();

    private EntityRelationshipRegistry()
        : base(
            typeof(EntityRelationshipRegistry).Assembly,
            relationship => relationship.Code,
            StringComparer.OrdinalIgnoreCase,
            relationships => relationships.OrderBy(relationship => relationship.Code, StringComparer.Ordinal))
    {
    }

    /// <summary>Relationship from a video series or season to an episode video.</summary>
    public static IEntityRelationship Episode => Require("episode");

    /// <summary>Relationship from a video series to a season grouping.</summary>
    public static IEntityRelationship Season => Require("season");

    /// <summary>Relationship from a user collection to one of its member entities.</summary>
    public static IEntityRelationship CollectionItem => Require("collection-item");

    /// <summary>Relationship from a gallery to either another gallery or one of its image entities.</summary>
    public static IEntityRelationship Gallery => Require("gallery");

    /// <summary>Relationship from an audio library to either another audio library or one of its track entities.</summary>
    public static IEntityRelationship AudioLibrary => Require("audio-library");

    /// <summary>Relationship from a book to a volume grouping.</summary>
    public static IEntityRelationship Volume => Require("volume");

    /// <summary>Relationship from a book or volume to a readable chapter.</summary>
    public static IEntityRelationship Chapter => Require("chapter");

    /// <summary>Relationship from a chapter to a readable page.</summary>
    public static IEntityRelationship Page => Require("page");

    /// <summary>Relationship from a tag to another tag.</summary>
    public static IEntityRelationship Tag => Require("tag");

    /// <summary>Relationship from a studio to another studio.</summary>
    public static IEntityRelationship Studio => Require("studio");

    /// <summary>
    /// Gets every known entity relationship in deterministic registry order.
    /// </summary>
    public static IReadOnlyList<IEntityRelationship> All => Registry.Items;

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
        => Registry.TryGetKey(code, out relationship);

    /// <summary>
    /// Looks up a relationship by code and fails when storage contains an unknown relationship.
    /// </summary>
    /// <param name="code">Relationship code from storage.</param>
    /// <returns>The registered entity relationship.</returns>
    /// <exception cref="InvalidOperationException">Thrown when the relationship code is not registered.</exception>
    public static IEntityRelationship Require(string code)
        => Registry.RequireKey(code, missingCode =>
            $"Unknown entity relationship code '{missingCode}'. Add an {nameof(IEntityRelationship)} implementation before using it.");
}
