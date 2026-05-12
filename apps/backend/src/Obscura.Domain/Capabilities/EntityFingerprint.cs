namespace Obscura.Domain.Capabilities;

/// <summary>
/// One hash or fingerprint value associated with an entity or one of its files.
/// </summary>
/// <param name="Algorithm">Stable hash algorithm code, such as <c>md5</c>, <c>oshash</c>, or <c>phash</c>.</param>
/// <param name="Value">Hash or fingerprint value.</param>
public sealed record EntityFingerprint(string Algorithm, string Value);
