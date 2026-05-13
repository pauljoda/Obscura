using Microsoft.Extensions.Logging;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Handlers;

/// <summary>
/// Computes MD5 and oshash fingerprints for an image entity.
/// </summary>
public sealed class FingerprintImageJobHandler(ILogger<FingerprintImageJobHandler> logger) : IJobHandler
{
    public JobType Type => JobType.FingerprintImage;

    public async Task HandleAsync(JobContext context, CancellationToken cancellationToken)
    {
        logger.LogInformation("FingerprintImage stub: {TargetLabel}", context.Job.TargetLabel);
        await context.ReportProgressAsync(100, "Stub complete", cancellationToken);
    }
}
