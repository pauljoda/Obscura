using Obscura.Application.Migrations;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Upgrades;

public sealed class V2UpgradeGate : IV2UpgradeGate
{
    public const string GateId = "v2-global-entities";
    private const string AcceptedPreferenceKey = $"system:v2-upgrade-gate:{GateId}:accepted";

    private readonly string _markerPath;
    private readonly ObscuraDbContext _db;

    public V2UpgradeGate(V2UpgradeGateOptions options, ObscuraDbContext db)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(options.DataDir);
        _markerPath = Path.Combine(options.DataDir, "upgrade-markers", $"{GateId}.accepted");
        _db = db;
    }

    public V2UpgradeGateStatus Check()
    {
        return new V2UpgradeGateStatus(GateId, HasPersistedAcceptance(), _markerPath);
    }

    public V2UpgradeGateStatus Accept()
    {
        PersistAcceptance();
        Directory.CreateDirectory(Path.GetDirectoryName(_markerPath)!);
        File.WriteAllText(_markerPath, $"{DateTimeOffset.UtcNow:O}{Environment.NewLine}");

        return Check();
    }

    public V2UpgradeGateStatus Prompt()
    {
        var row = _db.UiPreferences.Find(AcceptedPreferenceKey);
        if (row is not null)
        {
            _db.UiPreferences.Remove(row);
            _db.SaveChanges();
        }

        if (File.Exists(_markerPath))
        {
            File.Delete(_markerPath);
        }

        return Check();
    }

    private bool HasPersistedAcceptance()
    {
        if (_db.UiPreferences.Find(AcceptedPreferenceKey) is not null)
        {
            return true;
        }

        return File.Exists(_markerPath);
    }

    private void PersistAcceptance()
    {
        var now = DateTimeOffset.UtcNow;
        var row = _db.UiPreferences.Find(AcceptedPreferenceKey);
        if (row is null)
        {
            _db.UiPreferences.Add(new UiPreferenceRow
            {
                Key = AcceptedPreferenceKey,
                ValueJson = """{"accepted":true}""",
                UpdatedAt = now
            });
        }
        else
        {
            row.ValueJson = """{"accepted":true}""";
            row.UpdatedAt = now;
        }

        _db.SaveChanges();
    }
}
