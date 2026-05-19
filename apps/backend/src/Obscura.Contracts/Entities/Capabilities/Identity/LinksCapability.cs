using EntityUrl = Obscura.Domain.Capabilities.EntityUrl;
using EntityExternalId = Obscura.Domain.Capabilities.EntityExternalId;

namespace Obscura.Contracts.Entities;

/// <summary>API-facing external link capability.</summary>
/// <param name="Urls">External URLs for the entity.</param>
/// <param name="ExternalIds">Provider identifiers for matching and refresh.</param>
public sealed record LinksCapability(
    IReadOnlyList<EntityUrl> Urls,
    IReadOnlyList<EntityExternalId> ExternalIds) : EntityCapability;
