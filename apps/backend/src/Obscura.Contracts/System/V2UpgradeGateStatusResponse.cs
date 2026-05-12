namespace Obscura.Contracts.System;

/// <summary>
/// Response describing whether the breaking v2 upgrade gate has been accepted.
/// </summary>
/// <param name="GateId">Stable identifier for the current gate.</param>
/// <param name="Accepted">Whether the gate marker has been accepted.</param>
public sealed record V2UpgradeGateStatusResponse(
    string GateId,
    bool Accepted);
