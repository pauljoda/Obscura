using System.Text.Json;
using Microsoft.Extensions.Logging;
using Obscura.Application.Jobs.Ports;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Handlers;

/// <summary>
/// Base class for library scan handlers. Manages root ID parsing from the job payload,
/// root filtering by scan type, and the single-root vs. all-roots iteration pattern.
/// Subclasses implement <see cref="IsEligibleRoot"/> and <see cref="ScanRootAsync"/>.
/// </summary>
public abstract class ScanJobHandler(
    ILogger logger,
    IFileDiscovery fileDiscovery,
    ILibraryScanPersistence persistence) : IJobHandler
{
    public abstract JobType Type { get; }

    public async Task HandleAsync(JobContext context, CancellationToken cancellationToken)
    {
        var rootId = ParseRootId(context.Job.PayloadJson);
        if (rootId is null)
        {
            var roots = await persistence.GetEnabledRootsAsync(cancellationToken);
            var eligible = roots.Where(IsEligibleRoot).ToList();
            logger.LogInformation("{JobType}: scanning {Count} eligible roots", Type.ToCode(), eligible.Count);

            for (var i = 0; i < eligible.Count; i++)
            {
                await ScanRootAsync(context, eligible[i], cancellationToken);
                await context.ReportProgressAsync((i + 1) * 100 / eligible.Count,
                    $"Scanned {eligible[i].Label}", cancellationToken);
            }
        }
        else
        {
            var root = await persistence.GetLibraryRootAsync(rootId.Value, cancellationToken);
            if (root is null)
            {
                logger.LogWarning("{JobType}: root {RootId} not found", Type.ToCode(), rootId);
                return;
            }

            await ScanRootAsync(context, root, cancellationToken);
            await context.ReportProgressAsync(100, $"Scanned {root.Label}", cancellationToken);
        }
    }

    /// <summary>Returns true if this root should be scanned by this handler's media type.</summary>
    protected abstract bool IsEligibleRoot(LibraryRootData root);

    /// <summary>Discovers files, creates/updates entities, and enqueues downstream jobs for one root.</summary>
    protected abstract Task ScanRootAsync(JobContext context, LibraryRootData root, CancellationToken cancellationToken);

    /// <summary>File discovery port for subclass use.</summary>
    protected IFileDiscovery FileDiscovery => fileDiscovery;

    /// <summary>Scan persistence port for subclass use.</summary>
    protected ILibraryScanPersistence Persistence => persistence;

    private static Guid? ParseRootId(string? payloadJson)
    {
        if (string.IsNullOrWhiteSpace(payloadJson) || payloadJson == "{}")
            return null;

        try
        {
            using var doc = JsonDocument.Parse(payloadJson);
            if (doc.RootElement.TryGetProperty("rootId", out var prop) && prop.TryGetGuid(out var id))
                return id;
        }
        catch (JsonException) { }

        return null;
    }
}
