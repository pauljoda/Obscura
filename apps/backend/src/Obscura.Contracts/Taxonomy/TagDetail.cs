using Obscura.Contracts.Entities;

namespace Obscura.Contracts.Taxonomy;

/// <summary>
/// API-facing detail shape for a tag taxonomy entity.
/// </summary>
public sealed record TagDetail : EntityDetail {
    /// <summary>Whether automatic tagging should ignore this tag.</summary>
    public required bool IgnoreAutoTag { get; init; }
}
