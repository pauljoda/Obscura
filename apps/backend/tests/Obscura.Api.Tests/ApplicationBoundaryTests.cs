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

    [Fact]
    public void ApiEntityKindQueryUsesTypedEntityKindValue()
    {
        var type = typeof(Program).Assembly.GetType("Obscura.Api.Endpoints.EntityKindQuery");

        Assert.NotNull(type);
        Assert.Equal(typeof(IEntityKind), type.GetProperty("Value")?.PropertyType);
    }

    [Fact]
    public void ApiEndpointHelpersDoNotCarryEntityKindAsStrings()
    {
        var endpointTypes = typeof(Program).Assembly
            .GetTypes()
            .Where(type => type.Namespace == "Obscura.Api.Endpoints");

        var stringKindParameters = endpointTypes
            .SelectMany(type => type.GetMethods(BindingFlags.Static | BindingFlags.NonPublic | BindingFlags.Public))
            .SelectMany(method => method.GetParameters())
            .Where(parameter => parameter.Name is "kind" or "kindCode" && parameter.ParameterType == typeof(string))
            .ToArray();

        Assert.Empty(stringKindParameters);
    }
}
