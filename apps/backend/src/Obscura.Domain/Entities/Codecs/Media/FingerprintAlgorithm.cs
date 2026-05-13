namespace Obscura.Domain.Entities;

/// <summary>
/// Closed set of hash or fingerprint algorithms used for media file identification.
/// </summary>
public enum FingerprintAlgorithm
{
    /// <summary>Standard MD5 content hash.</summary>
    Md5,

    /// <summary>OpenSubtitles hash — fast size+sample-based fingerprint.</summary>
    Oshash,

    /// <summary>Perceptual hash for visual similarity matching.</summary>
    Phash
}

/// <summary>
/// Codec for fingerprint algorithm codes.
/// </summary>
public sealed class FingerprintAlgorithmCodec : EnumCodec<FingerprintAlgorithm>
{
    public FingerprintAlgorithmCodec()
        : base(new Dictionary<FingerprintAlgorithm, string>
        {
            [FingerprintAlgorithm.Md5] = "md5",
            [FingerprintAlgorithm.Oshash] = "oshash",
            [FingerprintAlgorithm.Phash] = "phash"
        })
    {
    }
}
