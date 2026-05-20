using Obscura.Application.Jobs;

namespace Obscura.Api.Endpoints;

internal static class JobListEndpoint {
    internal static RouteGroupBuilder MapJobListEndpoint(this RouteGroupBuilder group) {
        group.MapGet("/", (
            JobService jobs,
            CancellationToken cancellationToken) =>
            jobs.ListAsync(cancellationToken))
            .WithName("ListJobs")
            .WithSummary("Lists Obscura background job runs for the operations dashboard.");

        return group;
    }
}
