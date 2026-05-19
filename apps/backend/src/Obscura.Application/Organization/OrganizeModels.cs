namespace Obscura.Application.Organization;

/// <summary>
/// Application request for organization planning or apply operations.
/// </summary>
public sealed record OrganizePlanQuery(Guid? EntityId, Guid? RootId);

/// <summary>
/// Application result for one planned file or directory organization operation.
/// </summary>
public sealed record OrganizePlanItemResult(
    Guid EntityId,
    string Kind,
    string Title,
    string StorageShape,
    string SourcePath,
    string TargetPath,
    string Status,
    string? Reason);

/// <summary>
/// Application result for a dry-run organization plan.
/// </summary>
public sealed record OrganizePlanResult(IReadOnlyList<OrganizePlanItemResult> Items);

/// <summary>
/// Application result for applying an organization plan.
/// </summary>
public sealed record OrganizeApplyResult(
    IReadOnlyList<OrganizePlanItemResult> Items,
    int Applied,
    int Skipped);
