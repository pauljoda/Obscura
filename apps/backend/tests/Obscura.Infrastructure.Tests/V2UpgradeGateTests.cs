using Obscura.Infrastructure.Upgrades;
using Microsoft.EntityFrameworkCore;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Tests;

public sealed class V2UpgradeGateTests : IDisposable
{
    private readonly string _tempDir = Path.Combine(Path.GetTempPath(), $"obscura-v2-gate-{Guid.NewGuid():N}");

    [Fact]
    public void CheckReportsBlockedBeforeConsentMarkerExists()
    {
        using var db = CreateContext();
        var gate = new V2UpgradeGate(new V2UpgradeGateOptions(_tempDir), db);

        var status = gate.Check();

        Assert.False(status.Accepted);
        Assert.Equal("v2-global-entities", status.GateId);
    }

    [Fact]
    public void AcceptCreatesConsentMarker()
    {
        using var db = CreateContext();
        var gate = new V2UpgradeGate(new V2UpgradeGateOptions(_tempDir), db);

        var status = gate.Accept();

        Assert.True(status.Accepted);
        Assert.True(File.Exists(Path.Combine(_tempDir, "upgrade-markers", "v2-global-entities.accepted")));
        Assert.NotNull(db.UiPreferences.Find("system:v2-upgrade-gate:v2-global-entities:accepted"));
    }

    [Fact]
    public void CheckUsesPersistedDatabaseConsentWhenFileMarkerIsMissing()
    {
        using var db = CreateContext();
        db.UiPreferences.Add(new UiPreferenceRow
        {
            Key = "system:v2-upgrade-gate:v2-global-entities:accepted",
            ValueJson = """{"accepted":true}""",
            UpdatedAt = DateTimeOffset.UtcNow
        });
        db.SaveChanges();
        var gate = new V2UpgradeGate(new V2UpgradeGateOptions(_tempDir), db);

        var status = gate.Check();

        Assert.True(status.Accepted);
        Assert.False(File.Exists(Path.Combine(_tempDir, "upgrade-markers", "v2-global-entities.accepted")));
    }

    [Fact]
    public void PromptRemovesConsentMarker()
    {
        using var db = CreateContext();
        var gate = new V2UpgradeGate(new V2UpgradeGateOptions(_tempDir), db);
        gate.Accept();

        var status = gate.Prompt();

        Assert.False(status.Accepted);
        Assert.False(File.Exists(Path.Combine(_tempDir, "upgrade-markers", "v2-global-entities.accepted")));
        Assert.Null(db.UiPreferences.Find("system:v2-upgrade-gate:v2-global-entities:accepted"));
    }

    private static ObscuraDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ObscuraDbContext>()
            .UseInMemoryDatabase($"v2-upgrade-gate-{Guid.NewGuid():N}")
            .Options;

        return new ObscuraDbContext(options);
    }

    public void Dispose()
    {
        if (Directory.Exists(_tempDir))
        {
            Directory.Delete(_tempDir, recursive: true);
        }
    }
}
