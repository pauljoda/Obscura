using Obscura.Infrastructure.Upgrades;

namespace Obscura.Infrastructure.Tests;

public sealed class V2UpgradeGateTests : IDisposable
{
    private readonly string _tempDir = Path.Combine(Path.GetTempPath(), $"obscura-v2-gate-{Guid.NewGuid():N}");

    [Fact]
    public void CheckReportsBlockedBeforeConsentMarkerExists()
    {
        var gate = new V2UpgradeGate(new V2UpgradeGateOptions(_tempDir));

        var status = gate.Check();

        Assert.False(status.Accepted);
        Assert.Equal("v2-global-entities", status.GateId);
    }

    [Fact]
    public void AcceptCreatesConsentMarker()
    {
        var gate = new V2UpgradeGate(new V2UpgradeGateOptions(_tempDir));

        var status = gate.Accept();

        Assert.True(status.Accepted);
        Assert.True(File.Exists(Path.Combine(_tempDir, "upgrade-markers", "v2-global-entities.accepted")));
    }

    public void Dispose()
    {
        if (Directory.Exists(_tempDir))
        {
            Directory.Delete(_tempDir, recursive: true);
        }
    }
}
