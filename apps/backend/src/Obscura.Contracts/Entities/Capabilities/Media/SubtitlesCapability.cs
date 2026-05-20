using EntitySubtitle = Obscura.Domain.Capabilities.CapabilitySubtitles.Item;

namespace Obscura.Contracts.Entities;

/// <summary>API-facing subtitle capability.</summary>
[CapabilityKind("subtitles")]
public sealed record SubtitlesCapability(IReadOnlyList<EntitySubtitle> Items) : EntityCapability;
