namespace Obscura.Domain.Entities;

/// <summary>
/// Code-defined relationship types that can link one entity to another in the global hierarchy table.
/// </summary>
public enum EntityRelationshipCode
{
    /// <summary>A video-series entity contains a playable video episode.</summary>
    Episode,

    /// <summary>A video-series entity contains a season grouping.</summary>
    Season,

    /// <summary>A user-curated collection contains another entity.</summary>
    CollectionItem,

    /// <summary>A gallery contains another gallery.</summary>
    NestedGallery,

    /// <summary>A gallery contains an image entity.</summary>
    GalleryImage,

    /// <summary>An audio library contains another audio library.</summary>
    NestedAudioLibrary,

    /// <summary>An audio library contains an audio track entity.</summary>
    AudioTrack,

    /// <summary>A book entity contains a volume grouping.</summary>
    Volume,

    /// <summary>A book or volume entity contains a chapter entity.</summary>
    Chapter,

    /// <summary>A book chapter contains a page entity.</summary>
    Page,

    /// <summary>A tag contains another tag in a taxonomy hierarchy.</summary>
    NestedTag,

    /// <summary>A studio contains another studio in a taxonomy hierarchy.</summary>
    NestedStudio
}

/// <summary>
/// Contract implemented by every code-defined entity relationship.
/// </summary>
public interface IEntityRelationship
{
    private static readonly Lazy<IReadOnlyList<IEntityRelationship>> DiscoveredRelationships = new(DiscoverRelationships);

    private static readonly Lazy<IReadOnlyDictionary<string, IEntityRelationship>> ByCode = new(() => All.ToDictionary(
        relationship => relationship.Code,
        StringComparer.OrdinalIgnoreCase));

    private static readonly Lazy<IReadOnlyDictionary<EntityRelationshipCode, IEntityRelationship>> ByValue = new(() => All.ToDictionary(
        relationship => relationship.Value));

    /// <summary>Compile-time identity for the relationship.</summary>
    EntityRelationshipCode Value { get; }

    /// <summary>Stable code stored in the hierarchy table.</summary>
    string Code { get; }

    /// <summary>Human-readable label for diagnostics and future UI surfaces.</summary>
    string DisplayName { get; }

    /// <summary>True when the relationship represents canonical parentage instead of loose membership.</summary>
    bool IsStructural { get; }

    /// <summary>Relationship from a video series or season to an episode video.</summary>
    public static IEntityRelationship Episode => Require(EntityRelationshipCode.Episode);

    /// <summary>Relationship from a video series to a season grouping.</summary>
    public static IEntityRelationship Season => Require(EntityRelationshipCode.Season);

    /// <summary>Relationship from a user collection to one of its member entities.</summary>
    public static IEntityRelationship CollectionItem => Require(EntityRelationshipCode.CollectionItem);

    /// <summary>Relationship from a gallery to a nested gallery entity.</summary>
    public static IEntityRelationship NestedGallery => Require(EntityRelationshipCode.NestedGallery);

    /// <summary>Relationship from a gallery to one of its image entities.</summary>
    public static IEntityRelationship GalleryImage => Require(EntityRelationshipCode.GalleryImage);

    /// <summary>Relationship from an audio library to a nested audio library entity.</summary>
    public static IEntityRelationship NestedAudioLibrary => Require(EntityRelationshipCode.NestedAudioLibrary);

    /// <summary>Relationship from an audio library to one of its track entities.</summary>
    public static IEntityRelationship AudioTrack => Require(EntityRelationshipCode.AudioTrack);

    /// <summary>Relationship from a book to a volume grouping.</summary>
    public static IEntityRelationship Volume => Require(EntityRelationshipCode.Volume);

    /// <summary>Relationship from a book or volume to a readable chapter.</summary>
    public static IEntityRelationship Chapter => Require(EntityRelationshipCode.Chapter);

    /// <summary>Relationship from a chapter to a readable page.</summary>
    public static IEntityRelationship Page => Require(EntityRelationshipCode.Page);

    /// <summary>Relationship from a tag to a nested tag.</summary>
    public static IEntityRelationship NestedTag => Require(EntityRelationshipCode.NestedTag);

    /// <summary>Relationship from a studio to a nested studio.</summary>
    public static IEntityRelationship NestedStudio => Require(EntityRelationshipCode.NestedStudio);

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

    /// <summary>
    /// Looks up a relationship by compile-time identity and fails when it is not registered.
    /// </summary>
    /// <param name="value">Compile-time relationship identity.</param>
    /// <returns>The registered entity relationship.</returns>
    /// <exception cref="InvalidOperationException">Thrown when the relationship value is not registered.</exception>
    public static IEntityRelationship Require(EntityRelationshipCode value)
    {
        if (ByValue.Value.TryGetValue(value, out var relationship))
        {
            return relationship;
        }

        throw new InvalidOperationException($"Unknown entity relationship value '{value}'. Add an {nameof(IEntityRelationship)} implementation before using it.");
    }

    private static IReadOnlyList<IEntityRelationship> DiscoverRelationships() =>
        typeof(IEntityRelationship)
            .Assembly
            .GetTypes()
            .Where(type =>
                !type.IsAbstract &&
                !type.IsInterface &&
                typeof(IEntityRelationship).IsAssignableFrom(type) &&
                type.GetConstructor(Type.EmptyTypes) is not null)
            .Select(type => (IEntityRelationship)Activator.CreateInstance(type)!)
            .OrderBy(relationship => relationship.Value)
            .ToArray();
}
