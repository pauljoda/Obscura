namespace Obscura.Domain.Entities;

/// <summary>
/// Central registry for relationship codes that connect entities in the global hierarchy table.
/// </summary>
public static class EntityRelationships
{
    /// <summary>Relationship from a video series to an episode video.</summary>
    public static readonly EntityRelationship Episode = new(EntityRelationshipCode.Episode, "episode", "Episode");

    /// <summary>Relationship from a user collection to one of its member entities.</summary>
    public static readonly EntityRelationship CollectionItem = new(EntityRelationshipCode.CollectionItem, "collection-item", "Collection Item");

    /// <summary>Relationship from a gallery to a nested gallery entity.</summary>
    public static readonly EntityRelationship NestedGallery = new(EntityRelationshipCode.NestedGallery, "gallery", "Nested Gallery");

    /// <summary>Relationship from a gallery to one of its image entities.</summary>
    public static readonly EntityRelationship GalleryImage = new(EntityRelationshipCode.GalleryImage, "image", "Gallery Image");

    /// <summary>Relationship from an audio library to a nested audio library entity.</summary>
    public static readonly EntityRelationship NestedAudioLibrary = new(EntityRelationshipCode.NestedAudioLibrary, "audio-library", "Nested Audio Library");

    /// <summary>Relationship from an audio library to one of its track entities.</summary>
    public static readonly EntityRelationship AudioTrack = new(EntityRelationshipCode.AudioTrack, "audio-track", "Audio Track");
}
