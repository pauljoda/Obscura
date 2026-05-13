namespace Obscura.Domain.Entities;

/// <summary>
/// Closed set of queue job types currently known to the .NET backend.
/// </summary>
public enum JobType
{
    /// <summary>No-operation job used to verify queue plumbing.</summary>
    Noop,

    /// <summary>Library scan job.</summary>
    ScanLibrary,

    /// <summary>Video probe job.</summary>
    ProbeVideo,

    /// <summary>Legacy v1 video import job.</summary>
    LegacyVideoImport,

    /// <summary>Legacy v1 media import job.</summary>
    LegacyMediaImport
}

/// <summary>
/// Codec for queue job type codes.
/// </summary>
public sealed class JobTypeCodec : EnumCodec<JobType>
{
    public JobTypeCodec()
        : base(new Dictionary<JobType, string>
        {
            [JobType.Noop] = "noop",
            [JobType.ScanLibrary] = "scan-library",
            [JobType.ProbeVideo] = "probe-video",
            [JobType.LegacyVideoImport] = "legacy-video-import",
            [JobType.LegacyMediaImport] = "legacy-media-import"
        })
    {
    }
}
