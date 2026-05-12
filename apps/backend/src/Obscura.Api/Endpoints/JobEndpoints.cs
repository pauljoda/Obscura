using Obscura.Contracts.Jobs;
using Obscura.Domain.Entities;
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
            new JobListResponse(await queue.ListAsync(cancellationToken)))
            .WithName("ListJobs")
            .WithSummary("Lists Obscura background job runs for the operations dashboard.");

        group.MapPost("/{type}", async (
            string type,
            IJobQueueService queue,
            CancellationToken cancellationToken) =>
        {
            if (!type.TryDecodeAs<JobType>(out var jobType))
            {
                return Results.Problem(
                    title: "Unknown job type.",
                    detail: $"'{type}' is not a supported Obscura job type.",
                    statusCode: StatusCodes.Status400BadRequest);
            }

            var job = await queue.EnqueueAsync(jobType, cancellationToken);

            return Results.Accepted($"/api/jobs/{job.Id}", new JobCreateResponse(job));
        })
            .WithName("CreateJob")
            .WithSummary("Queues a background job run.");

        return group;
    }
}
