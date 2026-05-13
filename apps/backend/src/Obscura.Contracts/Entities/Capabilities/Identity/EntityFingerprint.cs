namespace Obscura.Contracts.Entities;

/// <summary>API-facing hash or fingerprint value associated with an entity.</summary>
/// <param name="Algorithm">Stable hash algorithm code.</param>
/// <param name="Value">Hash or fingerprint value.</param>
public sealed record EntityFingerprint(string Algorithm, string Value);
