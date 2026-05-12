namespace Obscura.Contracts.Entities;

/// <summary>API-facing shared description capability.</summary>
/// <param name="Value">User-facing description text.</param>
public sealed record DescriptionCapability(string Value) : EntityCapability;
