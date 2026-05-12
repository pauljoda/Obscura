namespace Obscura.Infrastructure.Legacy;

public interface ILegacyMediaImportService
{
    Task<LegacyMediaImportResult> ImportAsync(CancellationToken cancellationToken);
}
