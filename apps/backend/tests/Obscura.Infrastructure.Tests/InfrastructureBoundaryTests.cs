namespace Obscura.Infrastructure.Tests;

public sealed class InfrastructureBoundaryTests
{
    [Fact]
    public void InfrastructureDoesNotKeepOneToOneServiceInterfaces()
    {
        var infrastructureAssembly = typeof(Obscura.Infrastructure.DependencyInjection).Assembly;
        var removedInterfaceNames = new[]
        {
            "Obscura.Infrastructure.Backups.IDatabaseBackupService",
            "Obscura.Infrastructure.Backups.IProcessRunner",
            "Obscura.Infrastructure.Media.IMediaToolService",
            "Obscura.Infrastructure.Processes.IProcessExecutor"
        };

        Assert.All(
            removedInterfaceNames,
            name => Assert.Null(infrastructureAssembly.GetType(name)));
    }

    [Fact]
    public void ApplicationProjectDoesNotReferenceOuterLayersOrApiContracts()
    {
        var projectFile = ReadRepoFile("apps/backend/src/Obscura.Application/Obscura.Application.csproj");

        Assert.DoesNotContain("Obscura.Contracts", projectFile, StringComparison.Ordinal);
        Assert.DoesNotContain("Obscura.Infrastructure", projectFile, StringComparison.Ordinal);
        Assert.DoesNotContain("Obscura.Api", projectFile, StringComparison.Ordinal);
        Assert.DoesNotContain("Microsoft.EntityFrameworkCore", projectFile, StringComparison.Ordinal);
    }

    [Fact]
    public void ApplicationSourceDoesNotUseOuterLayerNamespaces()
    {
        var sourceFiles = Directory.GetFiles(
            RepoPath("apps/backend/src/Obscura.Application"),
            "*.cs",
            SearchOption.AllDirectories);

        Assert.All(sourceFiles, file =>
        {
            var source = File.ReadAllText(file);
            Assert.DoesNotContain("using Obscura.Contracts", source, StringComparison.Ordinal);
            Assert.DoesNotContain("using Obscura.Infrastructure", source, StringComparison.Ordinal);
            Assert.DoesNotContain("using Obscura.Api", source, StringComparison.Ordinal);
            Assert.DoesNotContain("using Microsoft.EntityFrameworkCore", source, StringComparison.Ordinal);
        });
    }

    [Fact]
    public void ApiEndpointsDoNotInjectInfrastructurePersistenceOrConcreteServices()
    {
        var endpointFiles = Directory.GetFiles(
            RepoPath("apps/backend/src/Obscura.Api/Endpoints"),
            "*.cs",
            SearchOption.TopDirectoryOnly);

        Assert.All(endpointFiles, file =>
        {
            var source = File.ReadAllText(file);
            Assert.DoesNotContain("using Obscura.Infrastructure", source, StringComparison.Ordinal);
            Assert.DoesNotContain("ObscuraDbContext", source, StringComparison.Ordinal);
            Assert.DoesNotContain("PluginCatalogService", source, StringComparison.Ordinal);
            Assert.DoesNotContain("IdentifyPluginService", source, StringComparison.Ordinal);
            Assert.DoesNotContain("IdentifySessionStore", source, StringComparison.Ordinal);
        });
    }

    private static string ReadRepoFile(string relativePath) => File.ReadAllText(RepoPath(relativePath));

    private static string RepoPath(string relativePath)
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null)
        {
            var candidate = Path.Combine(directory.FullName, relativePath);
            if (File.Exists(candidate) || Directory.Exists(candidate))
            {
                return candidate;
            }

            directory = directory.Parent;
        }

        throw new DirectoryNotFoundException($"Could not resolve repo path '{relativePath}'.");
    }
}
