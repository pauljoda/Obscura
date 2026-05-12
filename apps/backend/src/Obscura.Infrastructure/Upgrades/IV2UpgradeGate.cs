namespace Obscura.Infrastructure.Upgrades;

public interface IV2UpgradeGate
{
    V2UpgradeGateStatus Check();

    V2UpgradeGateStatus Accept();
}
