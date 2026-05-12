using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Obscura.Infrastructure.Persistence;

#nullable disable

namespace Obscura.Infrastructure.Persistence.Migrations;

/// <inheritdoc />
[DbContext(typeof(ObscuraDbContext))]
[Migration("20260512120000_RenameV2PerformerKindToPerson")]
public partial class RenameV2PerformerKindToPerson : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            INSERT INTO v2.entity_kinds (code, category, display_name)
            VALUES ('person', 'Taxonomy', 'Person')
            ON CONFLICT (code) DO UPDATE SET
                category = EXCLUDED.category,
                display_name = EXCLUDED.display_name;

            UPDATE v2.entities
            SET kind_code = 'person'
            WHERE kind_code = 'performer';

            UPDATE v2.entity_credit_links
            SET role = 'person'
            WHERE role = 'performer';

            DELETE FROM v2.entity_kinds
            WHERE code = 'performer';
            """);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            INSERT INTO v2.entity_kinds (code, category, display_name)
            VALUES ('performer', 'Taxonomy', 'Performer')
            ON CONFLICT (code) DO UPDATE SET
                category = EXCLUDED.category,
                display_name = EXCLUDED.display_name;

            UPDATE v2.entities
            SET kind_code = 'performer'
            WHERE kind_code = 'person';

            UPDATE v2.entity_credit_links
            SET role = 'performer'
            WHERE role = 'person';

            DELETE FROM v2.entity_kinds
            WHERE code = 'person';
            """);
    }
}
