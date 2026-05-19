namespace Obscura.Application.Plugins;

/// <summary>
/// Application port for plugin catalog operations.
/// </summary>
public interface IPluginCatalogUseCases
{
    Task<IReadOnlyList<object>> ListProvidersAsync(CancellationToken cancellationToken);

    Task<object?> InstallAsync(string provider, CancellationToken cancellationToken);

    Task<bool> RemoveAsync(string provider, CancellationToken cancellationToken);

    Task<bool> SaveAuthAsync(string provider, IReadOnlyDictionary<string, string?> values, CancellationToken cancellationToken);
}

/// <summary>
/// Application port for one-shot and bulk identify operations.
/// </summary>
public interface IIdentifyUseCases
{
    Task<IReadOnlyList<object>> ListProvidersAsync(string? kind, CancellationToken cancellationToken);

    Task<IdentifyUseCaseResult> IdentifyAsync(
        Guid entityId,
        string provider,
        object? query,
        CancellationToken cancellationToken);

    Task<bool> ApplyAsync(
        Guid entityId,
        object proposal,
        IReadOnlyList<string> selectedFields,
        IReadOnlyDictionary<string, string?>? selectedImages,
        CancellationToken cancellationToken);
}

/// <summary>
/// Application result for an identify attempt.
/// </summary>
public sealed record IdentifyUseCaseResult(bool Ok, object? Result, string? Error);

/// <summary>
/// Application store for transient in-memory bulk identify sessions.
/// </summary>
public interface IBulkIdentifySessions
{
    IdentifyBulkSessionResult Create(IReadOnlyList<Guid> entityIds, string provider);

    IdentifyBulkSessionResult? Get(Guid id);

    void Complete(Guid id, IReadOnlyList<IdentifyBulkResultResult> results);

    bool Close(Guid id);
}

/// <summary>
/// Application result for a transient bulk identify session.
/// </summary>
public sealed record IdentifyBulkSessionResult(
    Guid Id,
    string Provider,
    IReadOnlyList<Guid> EntityIds,
    IReadOnlyList<IdentifyBulkResultResult> Results,
    string Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset? CompletedAt = null);

/// <summary>
/// Application result for one entity inside a bulk identify session.
/// </summary>
public sealed record IdentifyBulkResultResult(Guid EntityId, IdentifyUseCaseResult Response);
