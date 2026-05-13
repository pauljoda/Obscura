using Obscura.Contracts.Jobs;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs;

/// <summary>
/// Application handler for executing one durable background job type.
/// </summary>
public interface IJobHandler
{
    /// <summary>
    /// Gets the job type handled by this implementation.
    /// </summary>
    JobType Type { get; }

    /// <summary>
    /// Executes the claimed job run.
    /// </summary>
    /// <param name="job">Claimed job run to execute.</param>
    /// <param name="cancellationToken">Token used to cancel execution.</param>
    Task HandleAsync(JobRun job, CancellationToken cancellationToken);
}
