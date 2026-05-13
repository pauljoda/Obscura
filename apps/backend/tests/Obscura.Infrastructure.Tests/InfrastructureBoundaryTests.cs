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
}
