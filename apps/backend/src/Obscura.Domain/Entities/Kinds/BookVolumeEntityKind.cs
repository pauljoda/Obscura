namespace Obscura.Domain.Entities;

/// <summary>Book volume structural entity kind.</summary>
public sealed record BookVolumeEntityKind()
    : IEntityKind
{
    public EntityKindCode Value => EntityKindCode.BookVolume;
    public string Code => "book-volume";
    public string DisplayName => "Book Volume";
    public EntityKindCategory Category => EntityKindCategory.Media;
}
