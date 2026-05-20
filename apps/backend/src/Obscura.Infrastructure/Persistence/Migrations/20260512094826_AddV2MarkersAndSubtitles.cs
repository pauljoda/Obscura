using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Obscura.Infrastructure.Persistence.Migrations {
    /// <inheritdoc />
    public partial class AddV2MarkersAndSubtitles : Migration {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder) {
            migrationBuilder.CreateTable(
                name: "entity_markers",
                schema: "v2",
                columns: table => new {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "text", nullable: false),
                    seconds = table.Column<double>(type: "double precision", nullable: false),
                    end_seconds = table.Column<double>(type: "double precision", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_entity_markers", x => x.id);
                    table.ForeignKey(
                        name: "FK_entity_markers_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "entity_subtitles",
                schema: "v2",
                columns: table => new {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    language = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    label = table.Column<string>(type: "text", nullable: true),
                    format = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    source = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    storage_path = table.Column<string>(type: "text", nullable: false),
                    source_format = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    source_path = table.Column<string>(type: "text", nullable: true),
                    is_default = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_entity_subtitles", x => x.id);
                    table.ForeignKey(
                        name: "FK_entity_subtitles_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_entity_markers_entity_id_seconds",
                schema: "v2",
                table: "entity_markers",
                columns: new[] { "entity_id", "seconds" });

            migrationBuilder.CreateIndex(
                name: "IX_entity_subtitles_entity_id_language_source",
                schema: "v2",
                table: "entity_subtitles",
                columns: new[] { "entity_id", "language", "source" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder) {
            migrationBuilder.DropTable(
                name: "entity_markers",
                schema: "v2");

            migrationBuilder.DropTable(
                name: "entity_subtitles",
                schema: "v2");
        }
    }
}
