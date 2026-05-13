using Obscura.Domain.Entities;

namespace Obscura.Domain.Capabilities;

/// <summary>
/// One hash or fingerprint value associated with an entity or one of its files.
/// </summary>
/// <param name="Algorithm">Hash algorithm used to produce this fingerprint.</param>
/// <param name="Value">Hash or fingerprint value.</param>
public sealed record EntityFingerprint(FingerprintAlgorithm Algorithm, string Value);
