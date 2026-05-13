using Npgsql;
using Obscura.Application.Migrations;

namespace Obscura.Infrastructure.Legacy;

public sealed class LegacyMediaImportService : ILegacyMediaImportService
{
    private readonly NpgsqlDataSource _dataSource;

    public LegacyMediaImportService(NpgsqlDataSource dataSource)
    {
        _dataSource = dataSource;
    }

    public async Task<LegacyMediaImportResult> ImportAsync(CancellationToken cancellationToken)
    {
        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        await using (var importCommand = new NpgsqlCommand(LegacyMediaImportSql.Import, connection, transaction))
        {
            await importCommand.ExecuteNonQueryAsync(cancellationToken);
        }

        LegacyMediaImportResult result;
        await using (var countCommand = new NpgsqlCommand(LegacyMediaImportSql.Counts, connection, transaction))
        await using (var reader = await countCommand.ExecuteReaderAsync(cancellationToken))
        {
            await reader.ReadAsync(cancellationToken);

            result = new LegacyMediaImportResult(
                reader.GetInt32(0),
                reader.GetInt32(1),
                reader.GetInt32(2),
                reader.GetInt32(3),
                reader.GetInt32(4),
                reader.GetInt32(5),
                reader.GetInt32(6));
        }

        await transaction.CommitAsync(cancellationToken);
        return result;
    }
}
