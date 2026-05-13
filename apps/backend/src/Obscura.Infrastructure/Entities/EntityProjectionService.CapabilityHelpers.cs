using Obscura.Domain.Entities;
using Obscura.Domain.Interfaces;

namespace Obscura.Infrastructure.Entities;

/// <summary>
/// Provides small helpers for resolving entity kinds during aggregate hydration.
/// </summary>
public sealed partial class EntityProjectionService
{
    private static IEntityKind ResolveKind(string code) => EntityKindRegistry.Require(code);

    private async Task<Entity?> GetEntityOfKindAsync(
        Guid id,
        IEntityKind kind,
        CancellationToken cancellationToken)
    {
        var entity = await GetAsync(id, cancellationToken);
        if (entity is null || !string.Equals(entity.Kind.Code, kind.Code, StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        return entity;
    }
}
