namespace Obscura.Domain.Entities;

/// <summary>Audio library grouping entity kind.</summary>
public sealed record AudioLibraryEntityKind()
    : IEntityKind
{
    public string Code => "audio-library";
    public string DisplayName => "Audio Library";
    public EntityKindCategory Category => EntityKindCategory.Media;
}
