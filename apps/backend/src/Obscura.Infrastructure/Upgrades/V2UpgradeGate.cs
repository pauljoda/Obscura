using Obscura.Application.Migrations;

namespace Obscura.Infrastructure.Upgrades;

public sealed class V2UpgradeGate : IV2UpgradeGate
{
    public const string GateId = "v2-global-entities";

    private readonly string _markerPath;

    public V2UpgradeGate(V2UpgradeGateOptions options)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(options.DataDir);
        _markerPath = Path.Combine(options.DataDir, "upgrade-markers", $"{GateId}.accepted");
    }

    public V2UpgradeGateStatus Check()
    {
        return new V2UpgradeGateStatus(GateId, File.Exists(_markerPath), _markerPath);
    }

    public V2UpgradeGateStatus Accept()
    {
        Directory.CreateDirectory(Path.GetDirectoryName(_markerPath)!);
        File.WriteAllText(_markerPath, $"{DateTimeOffset.UtcNow:O}{Environment.NewLine}");

        return Check();
    }

    public V2UpgradeGateStatus Prompt()
    {
        if (File.Exists(_markerPath))
        {
            File.Delete(_markerPath);
        }

        return Check();
    }
}
