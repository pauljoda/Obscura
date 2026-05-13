namespace Obscura.Domain.Entities;

/// <summary>
/// Closed set of statuses for outbound fingerprint submissions.
/// </summary>
public enum FingerprintSubmissionStatus
{
    /// <summary>Submission completed successfully.</summary>
    Success,

    /// <summary>Submission failed and the error field should explain why.</summary>
    Error
}

/// <summary>
/// Codec for outbound fingerprint submission status codes.
/// </summary>
public sealed class FingerprintSubmissionStatusCodec : EnumCodec<FingerprintSubmissionStatus>
{
    public FingerprintSubmissionStatusCodec()
        : base(new Dictionary<FingerprintSubmissionStatus, string>
        {
            [FingerprintSubmissionStatus.Success] = "success",
            [FingerprintSubmissionStatus.Error] = "error"
        })
    {
    }
}
