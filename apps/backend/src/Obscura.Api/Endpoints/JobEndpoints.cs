using Obscura.Contracts.Jobs;

namespace Obscura.Api.Endpoints;

public static class JobEndpoints
{
    public static RouteGroupBuilder MapJobEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/jobs")
            .WithTags("Jobs");

        group.MapGet("/", () => new JobListResponseDto([]))
            .WithName("ListJobs")
            .WithSummary("Lists Obscura background job runs for the operations dashboard.");

        group.MapPost("/{type}", (string type) =>
        {
            var job = new JobRunDto(
                Guid.NewGuid(),
                type,
                "queued",
                0,
                null,
                DateTimeOffset.UtcNow,
                null,
                null);

            return Results.Accepted($"/api/jobs/{job.Id}", new JobCreateResponseDto(job));
        })
            .WithName("CreateJob")
            .WithSummary("Queues a background job run.");

        return group;
    }
}
