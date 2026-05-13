using Obscura.Contracts.Jobs;
using Obscura.Domain.Entities;
using Obscura.Application.Migrations;

namespace Obscura.Worker;

public sealed class LegacyVideoImportJobHandler : IJobHandler
{
    private readonly IServiceScopeFactory _scopeFactory;

    public LegacyVideoImportJobHandler(IServiceScopeFactory scopeFactory)
    {
        _scopeFactory = scopeFactory;
    }

    public JobType Type => JobType.LegacyVideoImport;

    public async Task HandleAsync(JobRun job, CancellationToken cancellationToken)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var legacyImport = scope.ServiceProvider.GetRequiredService<ILegacyVideoImportService>();
        await legacyImport.ImportAsync(cancellationToken);
    }
}
