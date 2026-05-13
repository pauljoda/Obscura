using Obscura.Application.Jobs;
using Obscura.Contracts.Jobs;
using Obscura.Domain.Entities;

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
            JobTypeRoute type,
            JobService jobs,
            CancellationToken cancellationToken) =>
        {
            var response = await jobs.CreateAsync(type.Value, cancellationToken);

            return Results.Accepted($"/api/jobs/{response.Job.Id}", response);
        })
            .WithName("CreateJob")
            .WithSummary("Queues a background job run.");

        return group;
    }
}

/// <summary>
/// Route-bound job type value that decodes public job codes at the HTTP edge.
/// </summary>
/// <param name="Value">Typed job operation resolved from the route segment.</param>
public readonly record struct JobTypeRoute(JobType Value)
{
    /// <summary>
    /// Attempts to parse a route segment into a known typed job operation.
    /// </summary>
    /// <param name="value">Route segment supplied by the API caller.</param>
    /// <param name="provider">Format provider supplied by the minimal API binder.</param>
    /// <param name="result">Parsed route value when the segment is known.</param>
    /// <returns>True when the route segment maps to a registered job type.</returns>
    public static bool TryParse(string? value, IFormatProvider? provider, out JobTypeRoute result)
    {
        if (value is not null && value.TryDecodeAs<JobType>(out var type))
        {
            result = new JobTypeRoute(type);
            return true;
        }

        result = default;
        return false;
    }
}
