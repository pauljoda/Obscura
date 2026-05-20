using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Obscura.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class UseParentEntityForHierarchy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE v2.entities AS child
                SET parent_entity_id = link.parent_entity_id,
                    sort_order = link.sort_order,
                    updated_at = NOW()
                FROM v2.entity_child_links AS link
                WHERE link.child_entity_id = child.id
                  AND link.is_structural = TRUE;
                """);

            migrationBuilder.DropTable(
                name: "entity_child_links",
                schema: "v2");

            migrationBuilder.DropTable(
                name: "studio_details",
                schema: "v2");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "entity_child_links",
                schema: "v2",
                columns: table => new
                {
                    parent_entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    child_entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    child_kind_code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    is_structural = table.Column<bool>(type: "boolean", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    source = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_entity_child_links", x => new { x.parent_entity_id, x.child_entity_id, x.child_kind_code });
                    table.ForeignKey(
                        name: "FK_entity_child_links_entities_child_entity_id",
                        column: x => x.child_entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_entity_child_links_entities_parent_entity_id",
                        column: x => x.parent_entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_entity_child_links_entity_kinds_child_kind_code",
                        column: x => x.child_kind_code,
                        principalSchema: "v2",
                        principalTable: "entity_kinds",
                        principalColumn: "code",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "studio_details",
                schema: "v2",
                columns: table => new
                {
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_studio_details", x => x.entity_id);
                    table.ForeignKey(
                        name: "FK_studio_details_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.Sql("""
                INSERT INTO v2.entity_child_links (
                    parent_entity_id,
                    child_entity_id,
                    child_kind_code,
                    sort_order,
                    is_structural,
                    source,
                    created_at
                )
                SELECT
                    parent_entity_id,
                    id,
                    kind_code,
                    COALESCE(sort_order, 0),
                    TRUE,
                    'migration',
                    NOW()
                FROM v2.entities
                WHERE parent_entity_id IS NOT NULL;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_entity_child_links_child_entity_id",
                schema: "v2",
                table: "entity_child_links",
                column: "child_entity_id",
                unique: true,
                filter: "is_structural = true");

            migrationBuilder.CreateIndex(
                name: "IX_entity_child_links_child_kind_code",
                schema: "v2",
                table: "entity_child_links",
                column: "child_kind_code");

            migrationBuilder.CreateIndex(
                name: "IX_entity_child_links_parent_entity_id_child_kind_code_sort_or~",
                schema: "v2",
                table: "entity_child_links",
                columns: new[] { "parent_entity_id", "child_kind_code", "sort_order" });
        }
    }
}
