namespace Obscura.Domain.Entities;

/// <summary>Book volume structural entity kind.</summary>
public sealed record BookVolumeEntityKind()
    : EntityKind(EntityKindCode.BookVolume, "book-volume", "Book Volume", EntityKindCategory.Media);
