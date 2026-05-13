using Obscura.Application.Migrations;
using Obscura.Domain.Entities;
using Microsoft.Extensions.DependencyInjection;

namespace Obscura.Application.Jobs;

/// <summary>
/// Job handler that runs the legacy media preview import through the v2 migration port.
/// </summary>
public sealed class LegacyMediaImportJobHandler(IServiceScopeFactory scopeFactory) : IJobHandler
{
    /// <inheritdoc />
    public JobType Type => JobType.LegacyMediaImport;

    /// <inheritdoc />
    public async Task HandleAsync(JobContext context, CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var legacyImport = scope.ServiceProvider.GetRequiredService<ILegacyMediaImportService>();
        await legacyImport.ImportAsync(cancellationToken);
    }
}
