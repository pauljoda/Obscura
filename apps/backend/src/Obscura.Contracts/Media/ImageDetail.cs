using Obscura.Contracts.Entities;

namespace Obscura.Contracts.Media;

/// <summary>
/// API-facing detail shape for a single image entity.
/// </summary>
/// <param name="Id">Image entity identifier.</param>
/// <param name="Kind">Entity kind code.</param>
/// <param name="Title">Image title.</param>
/// <param name="Capabilities">Shared entity capabilities projected for the image.</param>
public sealed record ImageDetail(
    Guid Id,
    string Kind,
    string Title,
    IReadOnlyList<EntityCapability> Capabilities);
