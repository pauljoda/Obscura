using Obscura.Application.Migrations;
using Obscura.Domain.Entities;
using Microsoft.Extensions.DependencyInjection;

namespace Obscura.Application.Jobs;

/// <summary>
/// Job handler that runs the legacy video preview import through the v2 migration port.
/// </summary>
public sealed class LegacyVideoImportJobHandler : IJobHandler
{
    private readonly IServiceScopeFactory _scopeFactory;

    /// <summary>
    /// Creates a legacy video import handler that resolves scoped migration services per job.
    /// </summary>
    /// <param name="scopeFactory">Scope factory used to resolve scoped infrastructure adapters.</param>
    public LegacyVideoImportJobHandler(IServiceScopeFactory scopeFactory)
    {
        _scopeFactory = scopeFactory;
    }

    /// <inheritdoc />
    public JobType Type => JobType.LegacyVideoImport;

    /// <inheritdoc />
    public async Task HandleAsync(JobRunSnapshot job, CancellationToken cancellationToken)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var legacyImport = scope.ServiceProvider.GetRequiredService<ILegacyVideoImportService>();
        await legacyImport.ImportAsync(cancellationToken);
    }
}
