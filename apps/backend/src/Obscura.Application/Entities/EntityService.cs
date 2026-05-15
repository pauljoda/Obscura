using Obscura.Application.Mapping;
using Obscura.Application.Settings;
using Obscura.Contracts.Entities;
using Obscura.Domain.Entities;
using Obscura.Domain.Interfaces;

namespace Obscura.Application.Entities;

/// <summary>
/// Application use-case service for generic entity browsing and shared entity capability writes.
/// </summary>
public sealed class EntityService
{
    private readonly IEntityCatalog _entities;
    private readonly IRatingService _ratings;
    private readonly ISettingsService _settings;

    /// <summary>
    /// Creates an entity service over read and write domain ports.
    /// </summary>
    /// <param name="entities">Catalog used for entity read projections.</param>
    /// <param name="ratings">Capability writer used for rating and flag changes.</param>
    /// <param name="settings">Server-side settings used to enforce visibility before contracts are serialized.</param>
    public EntityService(IEntityCatalog entities, IRatingService ratings, ISettingsService settings)
    {
        _entities = entities;
        _ratings = ratings;
        _settings = settings;
    }

    /// <summary>
    /// Lists entities using application query language instead of API request DTOs.
    /// </summary>
    /// <param name="query">Entity list filters and cursor.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>API-ready entity list response.</returns>
    public async Task<EntityListResponse> ListAsync(EntityListQuery query, CancellationToken cancellationToken)
    {
        var hideNsfw = query.HideNsfw ?? (await _settings.GetAsync(cancellationToken)).HideNsfw;
        var page = await _entities.ListAsync(
            query.Kind,
            query.Search,
            query.Cursor,
            hideNsfw,
            cancellationToken);
        return ContractMapper.ToEntityListResponse(page);
    }

    /// <summary>
    /// Gets one entity by global identifier.
    /// </summary>
    /// <param name="id">Entity identifier.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>API-ready entity card, or null when it is missing.</returns>
    public async Task<EntityCard?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await _entities.GetAsync(id, cancellationToken);
        return entity is null ? null : ContractMapper.ToEntityCard(entity);
    }

    /// <summary>
    /// Lists related child entities for use cases that need hierarchy or membership expansion.
    /// </summary>
    /// <param name="parentId">Parent entity identifier.</param>
    /// <param name="relationship">Typed relationship to traverse.</param>
    /// <param name="childKind">Optional typed child kind filter.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>API-ready child entity cards in relationship order.</returns>
    public async Task<IReadOnlyList<EntityCard>> ListChildrenAsync(
        Guid parentId,
        IEntityRelationship relationship,
        IEntityKind? childKind,
        CancellationToken cancellationToken)
    {
        var children = await _entities.ListChildrenAsync(parentId, relationship, childKind, cancellationToken);
        return ContractMapper.ToEntityCards(children);
    }

    /// <summary>
    /// Applies a rating command and returns the updated entity projection.
    /// </summary>
    /// <param name="command">Rating command from the application boundary.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>API-ready updated entity card, or null when the entity is missing.</returns>
    public async Task<EntityCard?> SetRatingAsync(SetEntityRatingCommand command, CancellationToken cancellationToken)
    {
        var entity = await _ratings.UpdateRatingAsync(command.EntityId, command.Value, cancellationToken);
        return entity is null ? null : ContractMapper.ToEntityCard(entity);
    }

    /// <summary>
    /// Applies a partial flag update and returns the updated entity projection.
    /// </summary>
    /// <param name="command">Flag update command from the application boundary.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>API-ready updated entity card, or null when the entity is missing.</returns>
    public async Task<EntityCard?> UpdateFlagsAsync(UpdateEntityFlagsCommand command, CancellationToken cancellationToken)
    {
        var entity = await _ratings.UpdateFlagsAsync(
            command.EntityId,
            command.IsFavorite,
            command.IsNsfw,
            command.IsOrganized,
            cancellationToken);
        return entity is null ? null : ContractMapper.ToEntityCard(entity);
    }

    /// <summary>
    /// Applies a playback state change and returns the updated entity projection.
    /// </summary>
    /// <param name="command">Playback update command from the application boundary.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>API-ready updated entity card, or null when the entity is missing.</returns>
    public async Task<EntityCard?> UpdatePlaybackAsync(UpdatePlaybackCommand command, CancellationToken cancellationToken)
    {
        var entity = await _ratings.UpdatePlaybackAsync(
            command.EntityId,
            command.ResumeSeconds,
            command.DurationSeconds,
            command.Completed,
            cancellationToken);
        return entity is null ? null : ContractMapper.ToEntityCard(entity);
    }
}
