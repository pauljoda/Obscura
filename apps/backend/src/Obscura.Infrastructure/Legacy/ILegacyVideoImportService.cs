namespace Obscura.Infrastructure.Legacy;

public interface ILegacyVideoImportService
{
    Task<LegacyVideoImportResult> ImportAsync(CancellationToken cancellationToken);
}
