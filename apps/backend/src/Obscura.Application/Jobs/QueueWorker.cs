using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs;

/// <summary>
/// Hosted application service that claims durable queue jobs and dispatches them to typed handlers.
/// </summary>
public sealed class QueueWorker(
    IServiceScopeFactory scopeFactory,
    IEnumerable<IJobHandler> handlers,
    ILogger<QueueWorker> logger) : BackgroundService
{
    private static readonly TimeSpan IdleDelay = TimeSpan.FromSeconds(5);
    private static readonly TimeSpan RetryDelay = TimeSpan.FromSeconds(30);
    private readonly string _workerId = $"{Environment.MachineName}-{Guid.NewGuid():N}";
    private readonly IReadOnlyDictionary<JobType, IJobHandler> _handlers = handlers.ToDictionary(handler => handler.Type);

    /// <summary>
    /// Runs the worker loop until the host shuts down.
    /// </summary>
    /// <param name="stoppingToken">Token signaled when the worker host is stopping.</param>
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Obscura .NET worker {WorkerId} started.", _workerId);

        while (!stoppingToken.IsCancellationRequested)
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var queue = scope.ServiceProvider.GetRequiredService<IJobQueueService>();
            var job = await queue.ClaimNextAsync(_workerId, stoppingToken);

            if (job is null)
            {
                await Task.Delay(IdleDelay, stoppingToken);
                continue;
            }

            if (!_handlers.TryGetValue(job.Type, out var handler))
            {
                await queue.FailAsync(
                    job.Id,
                    $"No .NET handler is registered for job type '{job.Type}'.",
                    RetryDelay,
                    stoppingToken);
                continue;
            }

            try
            {
                await handler.HandleAsync(job, stoppingToken);
                await queue.CompleteAsync(job.Id, "Completed", stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Job {JobId} of type {JobType} failed.", job.Id, job.Type.ToCode());
                await queue.FailAsync(job.Id, ex.Message, RetryDelay, stoppingToken);
            }
        }
    }
}
