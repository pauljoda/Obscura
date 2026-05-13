using Microsoft.EntityFrameworkCore;
using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;
using Obscura.Domain.Interfaces;
using Obscura.Domain.Media;
using Obscura.Domain.Taxonomy;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Entities;

public sealed partial class EntityProjectionService
{
    private async Task<EntityHierarchyNode> BuildHierarchyNodeAsync(
        Entity entity,
        HierarchyDefinition definition,
        IEntityRelationship? relationshipToParent,
        int sortOrder,
        HashSet<Guid> visited,
        CancellationToken cancellationToken)
    {
        var childLinks = new List<LinkedEntity>();
        foreach (var layer in definition.Layers.Where(layer => layer.ParentKind == entity.Kind))
        {
            childLinks.AddRange(await LoadLinkedChildrenWithEdgesAsync(entity.Id, layer.Relationship, layer.ChildKind, cancellationToken));
        }

        var children = new List<EntityHierarchyNode>();
        foreach (var childLink in childLinks.OrderBy(link => link.SortOrder).ThenBy(link => link.Entity.Id))
        {
            if (!visited.Add(childLink.Entity.Id))
            {
                continue;
            }

            children.Add(await BuildHierarchyNodeAsync(
                childLink.Entity,
                definition,
                childLink.Relationship,
                childLink.SortOrder,
                visited,
                cancellationToken));
            visited.Remove(childLink.Entity.Id);
        }

        return new EntityHierarchyNode(entity, relationshipToParent, sortOrder, children);
    }

    private async Task<IReadOnlyList<Entity>> LoadLinkedChildrenAsync(
        Guid parentId,
        IEntityRelationship relationship,
        IEntityKind? childKind,
        CancellationToken cancellationToken)
    {
        var links = await _db.EntityHierarchyLinks
            .AsNoTracking()
            .Where(link => link.ParentEntityId == parentId && link.Relationship == relationship.Code)
            .OrderBy(link => link.SortOrder)
            .ThenBy(link => link.ChildEntityId)
            .ToListAsync(cancellationToken);

        if (links.Count == 0)
        {
            return [];
        }

        var childIds = links.Select(link => link.ChildEntityId).ToArray();
        var childQuery = _db.Entities
            .AsNoTracking()
            .Where(entity => childIds.Contains(entity.Id) && entity.DeletedAt == null);

        if (childKind is not null)
        {
            childQuery = childQuery.Where(entity => entity.KindCode == childKind.Code);
        }

        var childRows = await childQuery.ToListAsync(cancellationToken);
        var childCards = await BuildEntitiesAsync(childRows, cancellationToken);
        var cardsById = childCards.ToDictionary(card => card.Id);

        return links
            .Where(link => cardsById.ContainsKey(link.ChildEntityId))
            .Select(link => cardsById[link.ChildEntityId])
            .ToArray();
    }

    private async Task<IReadOnlyList<LinkedEntity>> LoadLinkedChildrenWithEdgesAsync(
        Guid parentId,
        IEntityRelationship relationship,
        IEntityKind? childKind,
        CancellationToken cancellationToken)
    {
        var links = await _db.EntityHierarchyLinks
            .AsNoTracking()
            .Where(link => link.ParentEntityId == parentId && link.Relationship == relationship.Code)
            .OrderBy(link => link.SortOrder)
            .ThenBy(link => link.ChildEntityId)
            .ToListAsync(cancellationToken);

        if (links.Count == 0)
        {
            return [];
        }

        var childIds = links.Select(link => link.ChildEntityId).ToArray();
        var childQuery = _db.Entities
            .AsNoTracking()
            .Where(entity => childIds.Contains(entity.Id) && entity.DeletedAt == null);

        if (childKind is not null)
        {
            childQuery = childQuery.Where(entity => entity.KindCode == childKind.Code);
        }

        var childRows = await childQuery.ToListAsync(cancellationToken);
        var cardsById = (await BuildEntitiesAsync(childRows, cancellationToken))
            .ToDictionary(entity => entity.Id);

        return links
            .Where(link => cardsById.ContainsKey(link.ChildEntityId))
            .Select(link => new LinkedEntity(cardsById[link.ChildEntityId], relationship, link.SortOrder))
            .ToArray();
    }



    private sealed record LinkedEntity(Entity Entity, IEntityRelationship Relationship, int SortOrder);
}
