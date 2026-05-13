using Obscura.Application.Jobs;
using Obscura.Domain.Entities;

namespace Obscura.Worker;

public sealed class QueueWorker(
    IServiceScopeFactory scopeFactory,
    IEnumerable<IJobHandler> handlers,
    ILogger<QueueWorker> logger) : BackgroundService
{
    private static readonly TimeSpan IdleDelay = TimeSpan.FromSeconds(5);
    private static readonly TimeSpan RetryDelay = TimeSpan.FromSeconds(30);
    private readonly string _workerId = $"{Environment.MachineName}-{Guid.NewGuid():N}";
    private readonly IReadOnlyDictionary<JobType, IJobHandler> _handlers = handlers.ToDictionary(handler => handler.Type);

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

            if (!job.Type.TryDecodeAs<JobType>(out var jobType) || !_handlers.TryGetValue(jobType, out var handler))
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
                logger.LogError(ex, "Job {JobId} of type {JobType} failed.", job.Id, job.Type);
                await queue.FailAsync(job.Id, ex.Message, RetryDelay, stoppingToken);
            }
        }
    }
}
