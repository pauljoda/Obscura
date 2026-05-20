using EntityFile = Obscura.Domain.Capabilities.CapabilityFiles.Item;

namespace Obscura.Contracts.Entities;

/// <summary>API-facing file capability.</summary>
/// <param name="Items">Files attached to the entity.</param>
[CapabilityKind("files")]
public sealed record FilesCapability(IReadOnlyList<EntityFile> Items) : EntityCapability;
