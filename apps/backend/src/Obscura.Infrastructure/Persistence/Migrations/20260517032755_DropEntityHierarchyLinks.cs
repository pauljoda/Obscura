using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Obscura.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class DropEntityHierarchyLinks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "entity_hierarchy_links",
                schema: "v2");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "entity_hierarchy_links",
                schema: "v2",
                columns: table => new
                {
                    parent_entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    child_entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    relationship = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_entity_hierarchy_links", x => new { x.parent_entity_id, x.child_entity_id, x.relationship });
                    table.ForeignKey(
                        name: "FK_entity_hierarchy_links_entities_child_entity_id",
                        column: x => x.child_entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_entity_hierarchy_links_entities_parent_entity_id",
                        column: x => x.parent_entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_entity_hierarchy_links_child_entity_id",
                schema: "v2",
                table: "entity_hierarchy_links",
                column: "child_entity_id");

            migrationBuilder.CreateIndex(
                name: "IX_entity_hierarchy_links_child_entity_id_relationship",
                schema: "v2",
                table: "entity_hierarchy_links",
                columns: new[] { "child_entity_id", "relationship" },
                unique: true,
                filter: "relationship IN ('audio-library', 'chapter', 'episode', 'gallery', 'page', 'season', 'studio', 'tag', 'volume')");

            migrationBuilder.CreateIndex(
                name: "IX_entity_hierarchy_links_parent_entity_id_sort_order",
                schema: "v2",
                table: "entity_hierarchy_links",
                columns: new[] { "parent_entity_id", "sort_order" });
        }
    }
}
