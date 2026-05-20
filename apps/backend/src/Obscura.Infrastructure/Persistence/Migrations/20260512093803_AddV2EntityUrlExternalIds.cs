using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Obscura.Infrastructure.Persistence.Migrations {
    /// <inheritdoc />
    public partial class AddV2EntityUrlExternalIds : Migration {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder) {
            migrationBuilder.CreateTable(
                name: "entity_external_ids",
                schema: "v2",
                columns: table => new {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    provider = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    value = table.Column<string>(type: "text", nullable: false),
                    url = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_entity_external_ids", x => x.id);
                    table.ForeignKey(
                        name: "FK_entity_external_ids_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "entity_urls",
                schema: "v2",
                columns: table => new {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    url = table.Column<string>(type: "text", nullable: false),
                    label = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_entity_urls", x => x.id);
                    table.ForeignKey(
                        name: "FK_entity_urls_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_entity_external_ids_entity_id_provider",
                schema: "v2",
                table: "entity_external_ids",
                columns: new[] { "entity_id", "provider" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_entity_external_ids_provider",
                schema: "v2",
                table: "entity_external_ids",
                column: "provider");

            migrationBuilder.CreateIndex(
                name: "IX_entity_urls_entity_id_sort_order",
                schema: "v2",
                table: "entity_urls",
                columns: new[] { "entity_id", "sort_order" });

            migrationBuilder.CreateIndex(
                name: "IX_entity_urls_entity_id_url",
                schema: "v2",
                table: "entity_urls",
                columns: new[] { "entity_id", "url" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder) {
            migrationBuilder.DropTable(
                name: "entity_external_ids",
                schema: "v2");

            migrationBuilder.DropTable(
                name: "entity_urls",
                schema: "v2");
        }
    }
}
