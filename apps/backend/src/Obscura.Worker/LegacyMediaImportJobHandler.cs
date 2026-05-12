using Obscura.Contracts.Jobs;
using Obscura.Domain.Entities;
using Obscura.Infrastructure.Legacy;

namespace Obscura.Worker;

public sealed class LegacyMediaImportJobHandler : IJobHandler
{
    private readonly IServiceScopeFactory _scopeFactory;

    public LegacyMediaImportJobHandler(IServiceScopeFactory scopeFactory)
    {
        _scopeFactory = scopeFactory;
    }

    public JobType Type => JobType.LegacyMediaImport;

    public async Task HandleAsync(JobRun job, CancellationToken cancellationToken)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var legacyImport = scope.ServiceProvider.GetRequiredService<ILegacyMediaImportService>();
        await legacyImport.ImportAsync(cancellationToken);
    }
}
