namespace Obscura.Domain.Entities;

/// <summary>
/// Central registry for relationship codes that connect entities in the global hierarchy table.
/// </summary>
public static class EntityRelationships
{
    /// <summary>Relationship from a video series to an episode video.</summary>
    public static readonly EntityRelationship Episode = new(EntityRelationshipCode.Episode, "episode", "Episode", true);

    /// <summary>Relationship from a video series to a season grouping.</summary>
    public static readonly EntityRelationship Season = new(EntityRelationshipCode.Season, "season", "Season", true);

    /// <summary>Relationship from a user collection to one of its member entities.</summary>
    public static readonly EntityRelationship CollectionItem = new(EntityRelationshipCode.CollectionItem, "collection-item", "Collection Item", false);

    /// <summary>Relationship from a gallery to a nested gallery entity.</summary>
    public static readonly EntityRelationship NestedGallery = new(EntityRelationshipCode.NestedGallery, "gallery", "Nested Gallery", true);

    /// <summary>Relationship from a gallery to one of its image entities.</summary>
    public static readonly EntityRelationship GalleryImage = new(EntityRelationshipCode.GalleryImage, "image", "Gallery Image", true);

    /// <summary>Relationship from an audio library to a nested audio library entity.</summary>
    public static readonly EntityRelationship NestedAudioLibrary = new(EntityRelationshipCode.NestedAudioLibrary, "audio-library", "Nested Audio Library", true);

    /// <summary>Relationship from an audio library to one of its track entities.</summary>
    public static readonly EntityRelationship AudioTrack = new(EntityRelationshipCode.AudioTrack, "audio-track", "Audio Track", true);

    /// <summary>Relationship from a book to a volume grouping.</summary>
    public static readonly EntityRelationship Volume = new(EntityRelationshipCode.Volume, "volume", "Volume", true);

    /// <summary>Relationship from a book or volume to a readable chapter.</summary>
    public static readonly EntityRelationship Chapter = new(EntityRelationshipCode.Chapter, "chapter", "Chapter", true);

    /// <summary>Relationship from a chapter to a readable page.</summary>
    public static readonly EntityRelationship Page = new(EntityRelationshipCode.Page, "page", "Page", true);

    /// <summary>Relationship from a tag to a nested tag.</summary>
    public static readonly EntityRelationship NestedTag = new(EntityRelationshipCode.NestedTag, "tag", "Nested Tag", true);

    /// <summary>Relationship from a studio to a nested studio.</summary>
    public static readonly EntityRelationship NestedStudio = new(EntityRelationshipCode.NestedStudio, "studio", "Nested Studio", true);

    private static readonly EntityRelationship[] Known =
    [
        Episode,
        Season,
        CollectionItem,
        NestedGallery,
        GalleryImage,
        NestedAudioLibrary,
        AudioTrack,
        Volume,
        Chapter,
        Page,
        NestedTag,
        NestedStudio
    ];

    private static readonly IReadOnlyDictionary<string, EntityRelationship> ByCode = Known.ToDictionary(
        relationship => relationship.Code,
        StringComparer.OrdinalIgnoreCase);

    /// <summary>
    /// Gets every known entity relationship in deterministic registry order.
    /// </summary>
    public static IReadOnlyList<EntityRelationship> All => Known;

    /// <summary>
    /// Gets canonical structural relationships that represent ownership or navigational parentage.
    /// </summary>
    public static IReadOnlyList<EntityRelationship> Structural => Known.Where(relationship => relationship.IsStructural).ToArray();

    /// <summary>
    /// Looks up an entity relationship by its stable code.
    /// </summary>
    /// <param name="code">Relationship code from storage or API input.</param>
    /// <param name="relationship">The matched relationship when the method returns true.</param>
    /// <returns>True when the code is known; otherwise false.</returns>
    public static bool TryGet(string? code, out EntityRelationship relationship)
    {
        if (code is not null && ByCode.TryGetValue(code, out var match))
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
    public static EntityRelationship Require(string code)
    {
        if (TryGet(code, out var relationship))
        {
            return relationship;
        }

        throw new InvalidOperationException($"Unknown entity relationship code '{code}'. Add it to {nameof(EntityRelationships)} before using it.");
    }
}
