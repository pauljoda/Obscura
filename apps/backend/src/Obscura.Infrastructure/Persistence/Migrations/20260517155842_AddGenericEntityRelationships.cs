using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Obscura.Infrastructure.Persistence.Migrations {
    /// <inheritdoc />
    public partial class AddGenericEntityRelationships : Migration {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder) {
            migrationBuilder.DropTable(
                name: "entity_credit_links",
                schema: "v2");

            migrationBuilder.DropTable(
                name: "entity_studio_links",
                schema: "v2");

            migrationBuilder.DropTable(
                name: "entity_tag_links",
                schema: "v2");

            migrationBuilder.DropColumn(
                name: "rendering_mode",
                schema: "v2",
                table: "video_series_details");

            migrationBuilder.CreateTable(
                name: "entity_relationship_links",
                schema: "v2",
                columns: table => new {
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    relationship_code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    target_entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    label = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    target_kind_code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    metadata_json = table.Column<string>(type: "jsonb", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_entity_relationship_links", x => new { x.entity_id, x.relationship_code, x.target_entity_id });
                    table.ForeignKey(
                        name: "FK_entity_relationship_links_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_entity_relationship_links_entities_target_entity_id",
                        column: x => x.target_entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_entity_relationship_links_entity_kinds_target_kind_code",
                        column: x => x.target_kind_code,
                        principalSchema: "v2",
                        principalTable: "entity_kinds",
                        principalColumn: "code",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_entity_relationship_links_entity_id_relationship_code_sort_~",
                schema: "v2",
                table: "entity_relationship_links",
                columns: new[] { "entity_id", "relationship_code", "sort_order" });

            migrationBuilder.CreateIndex(
                name: "IX_entity_relationship_links_target_entity_id",
                schema: "v2",
                table: "entity_relationship_links",
                column: "target_entity_id");

            migrationBuilder.CreateIndex(
                name: "IX_entity_relationship_links_target_kind_code_target_entity_id",
                schema: "v2",
                table: "entity_relationship_links",
                columns: new[] { "target_kind_code", "target_entity_id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder) {
            migrationBuilder.DropTable(
                name: "entity_relationship_links",
                schema: "v2");

            migrationBuilder.AddColumn<string>(
                name: "rendering_mode",
                schema: "v2",
                table: "video_series_details",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "entity_credit_links",
                schema: "v2",
                columns: table => new {
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    person_entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    role = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    character = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_entity_credit_links", x => new { x.entity_id, x.person_entity_id, x.role });
                    table.ForeignKey(
                        name: "FK_entity_credit_links_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_entity_credit_links_entities_person_entity_id",
                        column: x => x.person_entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "entity_studio_links",
                schema: "v2",
                columns: table => new {
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    studio_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_entity_studio_links", x => x.entity_id);
                    table.ForeignKey(
                        name: "FK_entity_studio_links_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_entity_studio_links_entities_studio_id",
                        column: x => x.studio_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "entity_tag_links",
                schema: "v2",
                columns: table => new {
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    tag_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_entity_tag_links", x => new { x.entity_id, x.tag_id });
                    table.ForeignKey(
                        name: "FK_entity_tag_links_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_entity_tag_links_entities_tag_id",
                        column: x => x.tag_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_entity_credit_links_entity_id_sort_order",
                schema: "v2",
                table: "entity_credit_links",
                columns: new[] { "entity_id", "sort_order" });

            migrationBuilder.CreateIndex(
                name: "IX_entity_credit_links_person_entity_id",
                schema: "v2",
                table: "entity_credit_links",
                column: "person_entity_id");

            migrationBuilder.CreateIndex(
                name: "IX_entity_studio_links_studio_id",
                schema: "v2",
                table: "entity_studio_links",
                column: "studio_id");

            migrationBuilder.CreateIndex(
                name: "IX_entity_tag_links_tag_id",
                schema: "v2",
                table: "entity_tag_links",
                column: "tag_id");
        }
    }
}
