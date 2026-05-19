namespace Obscura.Contracts.Entities;

/// <summary>API-facing rating capability.</summary>
/// <param name="Value">Rating value from 0 through 5, or null when no rating exists.</param>
public sealed record RatingCapability(int? Value) : EntityCapability;
