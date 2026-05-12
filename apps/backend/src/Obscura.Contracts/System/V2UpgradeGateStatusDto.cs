namespace Obscura.Contracts.System;

public sealed record V2UpgradeGateStatusDto(
    string GateId,
    bool Accepted);
