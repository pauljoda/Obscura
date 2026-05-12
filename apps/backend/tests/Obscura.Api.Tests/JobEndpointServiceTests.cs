using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Obscura.Contracts.Jobs;
using Obscura.Infrastructure.Queue;

namespace Obscura.Api.Tests;

public sealed class JobEndpointServiceTests
{
    [Fact]
    public async Task JobsEndpointListsJobsFromQueueService()
    {
        using var factory = CreateFactory();
        using var client = factory.CreateClient();

        var response = await client.GetFromJsonAsync<JobListResponseDto>("/api/jobs");

        Assert.NotNull(response);
        var job = Assert.Single(response.Items);
        Assert.Equal("scan-library", job.Type);
        Assert.Equal("queued", job.Status);
    }

    [Fact]
    public async Task CreateJobEndpointQueuesThroughQueueService()
    {
        using var factory = CreateFactory();
        using var client = factory.CreateClient();

        using var response = await client.PostAsync("/api/jobs/probe-video", null);
        var payload = await response.Content.ReadFromJsonAsync<JobCreateResponseDto>();

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        Assert.Equal("/api/jobs/22222222-2222-2222-2222-222222222222", response.Headers.Location?.OriginalString);
        Assert.NotNull(payload);
        Assert.Equal("probe-video", payload.Job.Type);
        Assert.Equal("queued", payload.Job.Status);
    }

    private static WebApplicationFactory<Program> CreateFactory()
    {
        return new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureServices(services =>
                {
                    services.AddScoped<IJobQueueService, FakeJobQueueService>();
                });
            });
    }

    private sealed class FakeJobQueueService : IJobQueueService
    {
        private static readonly Guid ExistingJobId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        private static readonly Guid CreatedJobId = Guid.Parse("22222222-2222-2222-2222-222222222222");

        public Task<IReadOnlyList<JobRunDto>> ListAsync(CancellationToken cancellationToken)
        {
            IReadOnlyList<JobRunDto> jobs =
            [
                new JobRunDto(ExistingJobId, "scan-library", "queued", 0, null, DateTimeOffset.UnixEpoch, null, null)
            ];

            return Task.FromResult(jobs);
        }

        public Task<JobRunDto> EnqueueAsync(string type, CancellationToken cancellationToken)
        {
            return Task.FromResult(new JobRunDto(
                CreatedJobId,
                type,
                "queued",
                0,
                null,
                DateTimeOffset.UnixEpoch,
                null,
                null));
        }

        public Task<JobRunDto?> ClaimNextAsync(string workerId, CancellationToken cancellationToken)
        {
            throw new NotSupportedException("The API endpoint tests do not claim jobs.");
        }

        public Task CompleteAsync(Guid id, string? message, CancellationToken cancellationToken)
        {
            throw new NotSupportedException("The API endpoint tests do not complete jobs.");
        }

        public Task FailAsync(
            Guid id,
            string message,
            TimeSpan retryDelay,
            CancellationToken cancellationToken)
        {
            throw new NotSupportedException("The API endpoint tests do not fail jobs.");
        }
    }
}
