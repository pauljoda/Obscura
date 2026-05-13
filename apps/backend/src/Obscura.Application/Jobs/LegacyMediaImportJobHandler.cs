using Obscura.Application.Migrations;
using Obscura.Domain.Entities;
using Microsoft.Extensions.DependencyInjection;

namespace Obscura.Application.Jobs;

/// <summary>
/// Job handler that runs the legacy media preview import through the v2 migration port.
/// </summary>
public sealed class LegacyMediaImportJobHandler : IJobHandler
{
    private readonly IServiceScopeFactory _scopeFactory;

    /// <summary>
    /// Creates a legacy media import handler that resolves scoped migration services per job.
    /// </summary>
    /// <param name="scopeFactory">Scope factory used to resolve scoped infrastructure adapters.</param>
    public LegacyMediaImportJobHandler(IServiceScopeFactory scopeFactory)
    {
        _scopeFactory = scopeFactory;
    }

    /// <inheritdoc />
    public JobType Type => JobType.LegacyMediaImport;

    /// <inheritdoc />
    public async Task HandleAsync(JobRunSnapshot job, CancellationToken cancellationToken)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var legacyImport = scope.ServiceProvider.GetRequiredService<ILegacyMediaImportService>();
        await legacyImport.ImportAsync(cancellationToken);
    }
}
