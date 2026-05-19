using System.Collections.Concurrent;
using Obscura.Application.Plugins;
using Obscura.Contracts.Plugins;

namespace Obscura.Infrastructure.Plugins;

/// <summary>
/// Application-facing adapter over the v2 plugin catalog infrastructure service.
/// </summary>
public sealed class PluginCatalogUseCases(PluginCatalogService catalog) : IPluginCatalogUseCases
{
    public async Task<IReadOnlyList<object>> ListProvidersAsync(CancellationToken cancellationToken) =>
        (await catalog.ListProvidersAsync(cancellationToken)).Cast<object>().ToArray();

    public async Task<object?> InstallAsync(string provider, CancellationToken cancellationToken) =>
        await catalog.InstallAsync(provider, cancellationToken);

    public Task<bool> RemoveAsync(string provider, CancellationToken cancellationToken) =>
        catalog.RemoveAsync(provider, cancellationToken);

    public Task<bool> SaveAuthAsync(
        string provider,
        IReadOnlyDictionary<string, string?> values,
        CancellationToken cancellationToken) =>
        catalog.SaveAuthAsync(provider, values, cancellationToken);
}

/// <summary>
/// Application-facing adapter over v2 identify infrastructure services.
/// </summary>
public sealed class IdentifyUseCases(IdentifyPluginService identify) : IIdentifyUseCases
{
    public async Task<IReadOnlyList<object>> ListProvidersAsync(string? kind, CancellationToken cancellationToken) =>
        (await identify.ListProvidersAsync(kind, cancellationToken)).Cast<object>().ToArray();

    public async Task<IdentifyUseCaseResult> IdentifyAsync(
        Guid entityId,
        string provider,
        object? query,
        CancellationToken cancellationToken)
    {
        var response = await identify.IdentifyAsync(
            entityId,
            provider,
            query as IdentifyQuery,
            cancellationToken);
        return new IdentifyUseCaseResult(response.Ok, response.Result, response.Error);
    }

    public Task<bool> ApplyAsync(
        Guid entityId,
        object proposal,
        IReadOnlyList<string> selectedFields,
        IReadOnlyDictionary<string, string?>? selectedImages,
        CancellationToken cancellationToken)
    {
        if (proposal is not EntityMetadataProposal typedProposal)
        {
            return Task.FromResult(false);
        }

        return identify.ApplyAsync(entityId, typedProposal, selectedFields, selectedImages, cancellationToken);
    }
}

/// <summary>
/// Infrastructure implementation of transient application bulk identify sessions.
/// </summary>
public sealed class ApplicationIdentifySessionStore : IBulkIdentifySessions
{
    private readonly ConcurrentDictionary<Guid, IdentifyBulkSessionResult> _sessions = new();

    public IdentifyBulkSessionResult Create(IReadOnlyList<Guid> entityIds, string provider)
    {
        var session = new IdentifyBulkSessionResult(Guid.NewGuid(), provider, entityIds, [], "running", DateTimeOffset.UtcNow);
        _sessions[session.Id] = session;
        return session;
    }

    public IdentifyBulkSessionResult? Get(Guid id) =>
        _sessions.TryGetValue(id, out var session) ? session : null;

    public void Complete(Guid id, IReadOnlyList<IdentifyBulkResultResult> results)
    {
        if (_sessions.TryGetValue(id, out var session))
        {
            _sessions[id] = session with
            {
                Results = results,
                Status = "complete",
                CompletedAt = DateTimeOffset.UtcNow
            };
        }
    }

    public bool Close(Guid id) => _sessions.TryRemove(id, out _);
}
