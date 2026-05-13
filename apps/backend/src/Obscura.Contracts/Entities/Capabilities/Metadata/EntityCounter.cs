namespace Obscura.Contracts.Entities;

/// <summary>API-facing named counter attached to an entity.</summary>
/// <param name="Code">Stable counter code.</param>
/// <param name="Value">Non-negative counter value.</param>
public sealed record EntityCounter(string Code, int Value);
