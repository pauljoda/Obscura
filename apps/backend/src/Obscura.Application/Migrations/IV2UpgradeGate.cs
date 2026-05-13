namespace Obscura.Application.Migrations;

/// <summary>
/// Application port for checking and accepting the one-time v2 global entity upgrade gate.
/// </summary>
public interface IV2UpgradeGate
{
    /// <summary>
    /// Reads the current consent status without mutating persistent state.
    /// </summary>
    /// <returns>The current upgrade-gate status.</returns>
    V2UpgradeGateStatus Check();

    /// <summary>
    /// Records consent for the v2 global entity migration and returns the updated status.
    /// </summary>
    /// <returns>The accepted upgrade-gate status.</returns>
    V2UpgradeGateStatus Accept();
}
