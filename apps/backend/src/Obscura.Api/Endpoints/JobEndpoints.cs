using Obscura.Application.Jobs;
using Obscura.Contracts.Jobs;

namespace Obscura.Api.Endpoints;

public static class JobEndpoints
{
    public static RouteGroupBuilder MapJobEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/jobs")
            .WithTags("Jobs");

        group.MapGet("/", async (
            JobService jobs,
            CancellationToken cancellationToken) =>
            await jobs.ListAsync(cancellationToken))
            .WithName("ListJobs")
            .WithSummary("Lists Obscura background job runs for the operations dashboard.");

        group.MapPost("/{type}", async (
            string type,
            JobService jobs,
            CancellationToken cancellationToken) =>
        {
            var result = await jobs.CreateAsync(type, cancellationToken);
            if (result.Response is null)
            {
                return Results.Problem(
                    title: "Unknown job type.",
                    detail: result.ErrorMessage,
                    statusCode: StatusCodes.Status400BadRequest);
            }

            return Results.Accepted($"/api/jobs/{result.Response.Job.Id}", result.Response);
        })
            .WithName("CreateJob")
            .WithSummary("Queues a background job run.");

        return group;
    }
}
