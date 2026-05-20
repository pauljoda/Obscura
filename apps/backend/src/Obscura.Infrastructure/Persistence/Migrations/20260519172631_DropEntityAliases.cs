using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Obscura.Infrastructure.Persistence.Migrations {
    /// <inheritdoc />
    public partial class DropEntityAliases : Migration {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder) {
            migrationBuilder.DropTable(
                name: "entity_aliases",
                schema: "v2");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder) {
            migrationBuilder.CreateTable(
                name: "entity_aliases",
                schema: "v2",
                columns: table => new {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    alias_type = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    value = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_entity_aliases", x => x.id);
                    table.ForeignKey(
                        name: "FK_entity_aliases_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_entity_aliases_entity_id_value",
                schema: "v2",
                table: "entity_aliases",
                columns: new[] { "entity_id", "value" },
                unique: true);
        }
    }
}
