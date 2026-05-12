namespace Obscura.Infrastructure.Upgrades;

public sealed record V2UpgradeGateStatus(
    string GateId,
    bool Accepted,
    string MarkerPath);
