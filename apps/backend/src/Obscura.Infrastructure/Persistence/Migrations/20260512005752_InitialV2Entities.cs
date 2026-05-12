using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Obscura.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialV2Entities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "v2");

            migrationBuilder.CreateTable(
                name: "entity_kinds",
                schema: "v2",
                columns: table => new
                {
                    code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    display_name = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    category = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_entity_kinds", x => x.code);
                });

            migrationBuilder.CreateTable(
                name: "entities",
                schema: "v2",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    kind_code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    title = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_entities", x => x.id);
                    table.ForeignKey(
                        name: "FK_entities_entity_kinds_kind_code",
                        column: x => x.kind_code,
                        principalSchema: "v2",
                        principalTable: "entity_kinds",
                        principalColumn: "code",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "entity_flags",
                schema: "v2",
                columns: table => new
                {
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    is_favorite = table.Column<bool>(type: "boolean", nullable: false),
                    is_nsfw = table.Column<bool>(type: "boolean", nullable: false),
                    is_organized = table.Column<bool>(type: "boolean", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_entity_flags", x => x.entity_id);
                    table.ForeignKey(
                        name: "FK_entity_flags_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "entity_ratings",
                schema: "v2",
                columns: table => new
                {
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    value = table.Column<int>(type: "integer", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_entity_ratings", x => x.entity_id);
                    table.CheckConstraint("ck_entity_ratings_value", "value >= 0 AND value <= 5");
                    table.ForeignKey(
                        name: "FK_entity_ratings_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "entity_tag_links",
                schema: "v2",
                columns: table => new
                {
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    tag_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
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

            migrationBuilder.CreateTable(
                name: "video_details",
                schema: "v2",
                columns: table => new
                {
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    summary = table.Column<string>(type: "text", nullable: true),
                    duration_ms = table.Column<long>(type: "bigint", nullable: true),
                    width = table.Column<int>(type: "integer", nullable: true),
                    height = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_video_details", x => x.entity_id);
                    table.ForeignKey(
                        name: "FK_video_details_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                schema: "v2",
                table: "entity_kinds",
                columns: new[] { "code", "category", "display_name" },
                values: new object[,]
                {
                    { "audio", "Media", "Audio" },
                    { "book", "Media", "Book" },
                    { "collection", "Collection", "Collection" },
                    { "gallery", "Media", "Gallery" },
                    { "image", "Media", "Image" },
                    { "performer", "Taxonomy", "Performer" },
                    { "studio", "Taxonomy", "Studio" },
                    { "tag", "Taxonomy", "Tag" },
                    { "video", "Media", "Video" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_entities_kind_code_title",
                schema: "v2",
                table: "entities",
                columns: new[] { "kind_code", "title" });

            migrationBuilder.CreateIndex(
                name: "IX_entity_tag_links_tag_id",
                schema: "v2",
                table: "entity_tag_links",
                column: "tag_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "entity_flags",
                schema: "v2");

            migrationBuilder.DropTable(
                name: "entity_ratings",
                schema: "v2");

            migrationBuilder.DropTable(
                name: "entity_tag_links",
                schema: "v2");

            migrationBuilder.DropTable(
                name: "video_details",
                schema: "v2");

            migrationBuilder.DropTable(
                name: "entities",
                schema: "v2");

            migrationBuilder.DropTable(
                name: "entity_kinds",
                schema: "v2");
        }
    }
}
