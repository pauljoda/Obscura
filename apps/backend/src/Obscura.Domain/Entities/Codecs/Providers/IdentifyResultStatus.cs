namespace Obscura.Domain.Entities;

/// <summary>
/// Closed set of review states for provider identification results.
/// </summary>
public enum IdentifyResultStatus {
    /// <summary>Result is waiting for review or application.</summary>
    Pending,

    /// <summary>Result was applied to the entity.</summary>
    Applied,

    /// <summary>Result was rejected by the user or rules engine.</summary>
    Rejected,

    /// <summary>Result could not be applied because provider data or persistence failed.</summary>
    Failed
}

/// <summary>
/// Codec for provider identification result status codes.
/// </summary>
public sealed class IdentifyResultStatusCodec : EnumCodec<IdentifyResultStatus> {
    public IdentifyResultStatusCodec()
        : base(new Dictionary<IdentifyResultStatus, string> {
            [IdentifyResultStatus.Pending] = "pending",
            [IdentifyResultStatus.Applied] = "applied",
            [IdentifyResultStatus.Rejected] = "rejected",
            [IdentifyResultStatus.Failed] = "failed"
        }) {
    }
}
