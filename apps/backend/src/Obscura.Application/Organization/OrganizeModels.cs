namespace Obscura.Application.Organization;

/// <summary>
/// Application request for organization planning or apply operations.
/// </summary>
public sealed record OrganizePlanQuery(Guid? EntityId, Guid? RootId);

/// <summary>
/// Lightweight projection of a watched media root used by the organize planner.
/// </summary>
public sealed record OrganizeLibraryRoot(Guid Id, string Path);

/// <summary>
/// Lightweight projection of an active domain entity used by the organize planner.
/// Carries only the columns the planner reads.
/// </summary>
public sealed record OrganizeEntityRow(
    Guid Id,
    string KindCode,
    string Title,
    Guid? ParentEntityId);

/// <summary>
/// Lightweight projection of the canonical source file for an entity.
/// </summary>
public sealed record OrganizeSourceFile(Guid EntityId, string Path);

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
