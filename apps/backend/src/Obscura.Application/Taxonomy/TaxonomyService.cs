using Obscura.Application.Entities;
using Obscura.Application.Mapping;
using Obscura.Application.Settings;
using Obscura.Contracts.Taxonomy;
using Obscura.Domain.Entities;
using Obscura.Domain.Interfaces;

namespace Obscura.Application.Taxonomy;

/// <summary>
/// Application use-case service for people, studios, and tags.
/// </summary>
public sealed class TaxonomyService
{
    private readonly IEntityCatalog _entities;
    private readonly IEntityDetails _details;
    private readonly ISettingsService _settings;

    /// <summary>
    /// Creates a taxonomy service over shared entity read ports.
    /// </summary>
    /// <param name="entities">Catalog used to list taxonomy entities.</param>
    /// <param name="details">Detail reader used to hydrate typed taxonomy aggregates.</param>
    /// <param name="settings">Server-side settings used to enforce visibility before contracts are serialized.</param>
    public TaxonomyService(IEntityCatalog entities, IEntityDetails details, ISettingsService settings)
    {
        _entities = entities;
        _details = details;
        _settings = settings;
    }

    /// <summary>
    /// Lists people.
    /// </summary>
    /// <param name="query">List query containing optional search text and cursor.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>API-ready person list response.</returns>
    public Task<TaxonomyListResponse> ListPeopleAsync(EntityListQuery query, CancellationToken cancellationToken) =>
        ListAsync(EntityKindRegistry.Person, query, cancellationToken);

    /// <summary>
    /// Lists studios.
    /// </summary>
    /// <param name="query">List query containing optional search text and cursor.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>API-ready studio list response.</returns>
    public Task<TaxonomyListResponse> ListStudiosAsync(EntityListQuery query, CancellationToken cancellationToken) =>
        ListAsync(EntityKindRegistry.Studio, query, cancellationToken);

    /// <summary>
    /// Lists tags.
    /// </summary>
    /// <param name="query">List query containing optional search text and cursor.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>API-ready tag list response.</returns>
    public Task<TaxonomyListResponse> ListTagsAsync(EntityListQuery query, CancellationToken cancellationToken) =>
        ListAsync(EntityKindRegistry.Tag, query, cancellationToken);

    /// <summary>
    /// Gets one person detail contract.
    /// </summary>
    /// <param name="id">Person entity identifier.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>Person detail contract, or null when missing.</returns>
    public async Task<PersonDetail?> GetPersonAsync(Guid id, CancellationToken cancellationToken)
    {
        var person = await _details.GetPersonAsync(id, cancellationToken);
        return person is null ? null : ContractMapper.ToPersonDetail(person);
    }

    /// <summary>
    /// Gets one studio detail contract.
    /// </summary>
    /// <param name="id">Studio entity identifier.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>Studio detail contract, or null when missing.</returns>
    public async Task<StudioDetail?> GetStudioAsync(Guid id, CancellationToken cancellationToken)
    {
        var studio = await _details.GetStudioAsync(id, cancellationToken);
        return studio is null ? null : ContractMapper.ToStudioDetail(studio);
    }

    /// <summary>
    /// Gets one tag detail contract.
    /// </summary>
    /// <param name="id">Tag entity identifier.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>Tag detail contract, or null when missing.</returns>
    public async Task<TagDetail?> GetTagAsync(Guid id, CancellationToken cancellationToken)
    {
        var tag = await _details.GetTagAsync(id, cancellationToken);
        return tag is null ? null : ContractMapper.ToTagDetail(tag);
    }

    private async Task<TaxonomyListResponse> ListAsync(
        IEntityKind kind,
        EntityListQuery query,
        CancellationToken cancellationToken)
    {
        var settings = await _settings.GetAsync(cancellationToken);
        var page = await _entities.ListAsync(kind, query.Search, query.Cursor, settings.HideNsfw, cancellationToken);
        return ContractMapper.ToTaxonomyListResponse(page);
    }
}
