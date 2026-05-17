using Obscura.Contracts.Organize;

namespace Obscura.Application.Organization;

/// <summary>
/// Computes and applies filesystem organization plans for entities using generic entity-kind metadata.
/// </summary>
public interface IEntityOrganizer
{
    /// <summary>
    /// Builds a dry-run organization plan without moving files.
    /// </summary>
    /// <param name="request">Optional entity or library-root scope.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>Planned operations for source-backed entities.</returns>
    Task<OrganizePlanResponse> PlanAsync(
        OrganizePlanRequest request,
        CancellationToken cancellationToken);

    /// <summary>
    /// Applies a previously computable organization plan by moving source files/folders and updating source paths.
    /// </summary>
    /// <param name="request">Optional entity or library-root scope.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>Final operation statuses after apply.</returns>
    Task<OrganizeApplyResponse> ApplyAsync(
        OrganizePlanRequest request,
        CancellationToken cancellationToken);
}
