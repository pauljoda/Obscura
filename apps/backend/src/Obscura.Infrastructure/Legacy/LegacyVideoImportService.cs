using Npgsql;
using Obscura.Application.Migrations;

namespace Obscura.Infrastructure.Legacy;

public sealed class LegacyVideoImportService : ILegacyVideoImportService
{
    private readonly NpgsqlDataSource _dataSource;

    public LegacyVideoImportService(NpgsqlDataSource dataSource)
    {
        _dataSource = dataSource;
    }

    public async Task<LegacyVideoImportResult> ImportAsync(CancellationToken cancellationToken)
    {
        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        await using (var importCommand = new NpgsqlCommand(LegacyVideoImportSql.Import, connection, transaction))
        {
            await importCommand.ExecuteNonQueryAsync(cancellationToken);
        }

        LegacyVideoImportResult result;
        await using (var countCommand = new NpgsqlCommand(LegacyVideoImportSql.Counts, connection, transaction))
        await using (var reader = await countCommand.ExecuteReaderAsync(cancellationToken))
        {
            await reader.ReadAsync(cancellationToken);

            result = new LegacyVideoImportResult(
                reader.GetInt32(0),
                reader.GetInt32(1),
                reader.GetInt32(2),
                reader.GetInt32(3),
                reader.GetInt32(4),
                reader.GetInt32(5));
        }

        await transaction.CommitAsync(cancellationToken);
        return result;
    }
}
