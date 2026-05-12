namespace Obscura.Domain.Entities;

/// <summary>Generic audio entity kind.</summary>
public sealed record AudioEntityKind()
    : IEntityKind
{
    public EntityKindCode Value => EntityKindCode.Audio;
    public string Code => "audio";
    public string DisplayName => "Audio";
    public EntityKindCategory Category => EntityKindCategory.Media;
}
