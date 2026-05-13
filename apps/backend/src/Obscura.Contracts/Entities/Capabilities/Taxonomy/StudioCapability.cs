namespace Obscura.Contracts.Entities;

/// <summary>API-facing primary studio capability.</summary>
/// <param name="Value">Primary studio or publisher-like entity.</param>
public sealed record StudioCapability(EntityReference? Value) : EntityCapability;
