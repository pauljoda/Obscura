using System.Reflection;
using Obscura.Application.Jobs;
using Obscura.Domain.Entities;

namespace Obscura.Api.Tests;

public sealed class ApplicationBoundaryTests
{
    [Fact]
    public void JobServiceCreatesJobsFromTypedJobType()
    {
        var method = Assert.Single(
            typeof(JobService).GetMethods(BindingFlags.Instance | BindingFlags.Public),
            method => method.Name == nameof(JobService.CreateAsync));

        Assert.Equal(typeof(JobType), method.GetParameters()[0].ParameterType);
    }

    [Fact]
    public void JobQueuePortUsesTypedJobSnapshots()
    {
        var methods = typeof(IJobQueueService).GetMethods(BindingFlags.Instance | BindingFlags.Public);

        Assert.All(
            methods.Where(method => method.Name is nameof(IJobQueueService.ListAsync) or nameof(IJobQueueService.EnqueueAsync) or nameof(IJobQueueService.ClaimNextAsync)),
            method => Assert.DoesNotContain(
                "Obscura.Contracts.Jobs.JobRun",
                method.ReturnType.FullName ?? method.ReturnType.Name));
    }
}
