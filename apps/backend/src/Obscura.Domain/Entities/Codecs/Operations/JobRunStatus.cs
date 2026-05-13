namespace Obscura.Domain.Entities;

/// <summary>
/// Closed set of queue job lifecycle statuses.
/// </summary>
public enum JobRunStatus
{
    /// <summary>Job is waiting to be claimed by a worker.</summary>
    Queued,

    /// <summary>Job has been claimed and is currently running.</summary>
    Running,

    /// <summary>Job finished successfully.</summary>
    Completed,

    /// <summary>Job exhausted retry rules or failed permanently.</summary>
    Failed,

    /// <summary>Job was cancelled before completion.</summary>
    Cancelled
}

/// <summary>
/// Codec for queue job lifecycle status codes.
/// </summary>
public sealed class JobRunStatusCodec : EnumCodec<JobRunStatus>
{
    public JobRunStatusCodec()
        : base(new Dictionary<JobRunStatus, string>
        {
            [JobRunStatus.Queued] = "queued",
            [JobRunStatus.Running] = "running",
            [JobRunStatus.Completed] = "completed",
            [JobRunStatus.Failed] = "failed",
            [JobRunStatus.Cancelled] = "cancelled"
        })
    {
    }
}
