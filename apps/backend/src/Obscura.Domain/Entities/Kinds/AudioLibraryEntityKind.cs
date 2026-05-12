namespace Obscura.Domain.Entities;

/// <summary>Audio library grouping entity kind.</summary>
public sealed record AudioLibraryEntityKind()
    : EntityKind(EntityKindCode.AudioLibrary, "audio-library", "Audio Library", EntityKindCategory.Media);
