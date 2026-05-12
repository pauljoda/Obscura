namespace Obscura.Contracts.System;

public sealed record V2UpgradeGateStatusResponse(
    string GateId,
    bool Accepted);
