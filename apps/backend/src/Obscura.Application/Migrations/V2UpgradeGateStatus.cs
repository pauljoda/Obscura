namespace Obscura.Application.Migrations;

/// <summary>
/// Status for the v2 breaking-change consent gate.
/// </summary>
/// <param name="GateId">Stable identifier for the gate being checked.</param>
/// <param name="Accepted">Whether the user has accepted the breaking v2 data reset.</param>
/// <param name="MarkerPath">Infrastructure marker path used to persist acceptance.</param>
public sealed record V2UpgradeGateStatus(
    string GateId,
    bool Accepted,
    string MarkerPath);
