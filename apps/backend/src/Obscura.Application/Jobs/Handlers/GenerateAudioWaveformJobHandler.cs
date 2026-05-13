using Microsoft.Extensions.Logging;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Handlers;

/// <summary>
/// Generates waveform peak data for audio playback visualization.
/// </summary>
public sealed class GenerateAudioWaveformJobHandler(ILogger<GenerateAudioWaveformJobHandler> logger) : IJobHandler
{
    public JobType Type => JobType.GenerateAudioWaveform;

    public async Task HandleAsync(JobContext context, CancellationToken cancellationToken)
    {
        logger.LogInformation("GenerateAudioWaveform stub: {TargetLabel}", context.Job.TargetLabel);
        await context.ReportProgressAsync(100, "Stub complete", cancellationToken);
    }
}
