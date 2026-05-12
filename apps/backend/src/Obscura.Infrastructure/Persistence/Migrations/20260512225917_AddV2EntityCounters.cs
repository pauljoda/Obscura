using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Obscura.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddV2EntityCounters : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_entity_hierarchy_links_child_entity_id_relationship",
                schema: "v2",
                table: "entity_hierarchy_links");

            migrationBuilder.CreateTable(
                name: "entity_counters",
                schema: "v2",
                columns: table => new
                {
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    value = table.Column<int>(type: "integer", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_entity_counters", x => new { x.entity_id, x.code });
                    table.CheckConstraint("ck_entity_counters_value", "value >= 0");
                    table.ForeignKey(
                        name: "FK_entity_counters_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_entity_hierarchy_links_child_entity_id_relationship",
                schema: "v2",
                table: "entity_hierarchy_links",
                columns: new[] { "child_entity_id", "relationship" },
                unique: true,
                filter: "relationship IN ('audio-library', 'chapter', 'episode', 'gallery', 'page', 'season', 'studio', 'tag', 'volume')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "entity_counters",
                schema: "v2");

            migrationBuilder.DropIndex(
                name: "IX_entity_hierarchy_links_child_entity_id_relationship",
                schema: "v2",
                table: "entity_hierarchy_links");

            migrationBuilder.CreateIndex(
                name: "IX_entity_hierarchy_links_child_entity_id_relationship",
                schema: "v2",
                table: "entity_hierarchy_links",
                columns: new[] { "child_entity_id", "relationship" },
                unique: true,
                filter: "relationship IN ('episode', 'season', 'gallery', 'image', 'audio-library', 'audio-track', 'volume', 'chapter', 'page', 'tag', 'studio')");
        }
    }
}
