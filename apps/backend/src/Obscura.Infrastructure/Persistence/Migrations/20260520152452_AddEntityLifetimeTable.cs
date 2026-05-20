using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Obscura.Infrastructure.Persistence.Migrations {
    /// <inheritdoc />
    public partial class AddEntityLifetimeTable : Migration {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder) {
            migrationBuilder.CreateTable(
                name: "entity_lifetimes",
                schema: "v2",
                columns: table => new {
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    start_code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    start_value = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    start_sortable_value = table.Column<DateOnly>(type: "date", nullable: true),
                    start_precision = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    end_code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    end_value = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    end_sortable_value = table.Column<DateOnly>(type: "date", nullable: true),
                    end_precision = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    label = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_entity_lifetimes", x => x.entity_id);
                    table.ForeignKey(
                        name: "FK_entity_lifetimes_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder) {
            migrationBuilder.DropTable(
                name: "entity_lifetimes",
                schema: "v2");
        }
    }
}
