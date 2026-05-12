using Obscura.Contracts.Jobs;
using Obscura.Infrastructure.Queue;

namespace Obscura.Api.Endpoints;

public static class JobEndpoints
{
    public static RouteGroupBuilder MapJobEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/jobs")
            .WithTags("Jobs");

        group.MapGet("/", async (
            IJobQueueService queue,
            CancellationToken cancellationToken) =>
            new JobListResponseDto(await queue.ListAsync(cancellationToken)))
            .WithName("ListJobs")
            .WithSummary("Lists Obscura background job runs for the operations dashboard.");

        group.MapPost("/{type}", async (
            string type,
            IJobQueueService queue,
            CancellationToken cancellationToken) =>
        {
            var job = await queue.EnqueueAsync(type, cancellationToken);

            return Results.Accepted($"/api/jobs/{job.Id}", new JobCreateResponseDto(job));
        })
            .WithName("CreateJob")
            .WithSummary("Queues a background job run.");

        return group;
    }
}
