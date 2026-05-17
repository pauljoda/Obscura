using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Obscura.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddGenericEntityGraph : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "allowed_child_kind_codes",
                schema: "v2",
                table: "entity_kinds",
                type: "jsonb",
                nullable: false,
                defaultValue: "[]");

            migrationBuilder.AddColumn<bool>(
                name: "is_leaf",
                schema: "v2",
                table: "entity_kinds",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "storage_shape",
                schema: "v2",
                table: "entity_kinds",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "none");

            migrationBuilder.AddColumn<Guid>(
                name: "parent_entity_id",
                schema: "v2",
                table: "entities",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "sort_order",
                schema: "v2",
                table: "entities",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "entity_child_links",
                schema: "v2",
                columns: table => new
                {
                    parent_entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    child_entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    child_kind_code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    is_structural = table.Column<bool>(type: "boolean", nullable: false),
                    source = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
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

            migrationBuilder.UpdateData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "audio",
                columns: new[] { "allowed_child_kind_codes", "is_leaf", "storage_shape" },
                values: new object[] { "[]", true, "file" });

            migrationBuilder.UpdateData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "audio-library",
                columns: new[] { "allowed_child_kind_codes", "is_leaf", "storage_shape" },
                values: new object[] { "[\"audio-library\",\"audio-track\"]", false, "folder" });

            migrationBuilder.UpdateData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "audio-track",
                columns: new[] { "allowed_child_kind_codes", "is_leaf", "storage_shape" },
                values: new object[] { "[]", true, "file" });

            migrationBuilder.UpdateData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "book",
                columns: new[] { "allowed_child_kind_codes", "is_leaf", "storage_shape" },
                values: new object[] { "[\"book-volume\",\"book-chapter\",\"book-page\"]", true, "archive" });

            migrationBuilder.UpdateData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "book-chapter",
                columns: new[] { "allowed_child_kind_codes", "is_leaf", "storage_shape" },
                values: new object[] { "[\"book-page\"]", false, "none" });

            migrationBuilder.UpdateData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "book-page",
                columns: new[] { "allowed_child_kind_codes", "is_leaf", "storage_shape" },
                values: new object[] { "[]", true, "archive-entry" });

            migrationBuilder.UpdateData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "book-volume",
                columns: new[] { "allowed_child_kind_codes", "is_leaf", "storage_shape" },
                values: new object[] { "[\"book-chapter\",\"book-page\"]", false, "none" });

            migrationBuilder.UpdateData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "collection",
                columns: new[] { "allowed_child_kind_codes", "is_leaf", "storage_shape" },
                values: new object[] { "[\"audio\",\"audio-library\",\"audio-track\",\"book\",\"book-chapter\",\"book-page\",\"book-volume\",\"collection\",\"gallery\",\"image\",\"person\",\"studio\",\"tag\",\"video\",\"video-season\",\"video-series\"]", false, "none" });

            migrationBuilder.UpdateData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "gallery",
                columns: new[] { "allowed_child_kind_codes", "is_leaf", "storage_shape" },
                values: new object[] { "[\"gallery\",\"image\"]", false, "folder" });

            migrationBuilder.UpdateData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "image",
                columns: new[] { "allowed_child_kind_codes", "is_leaf", "storage_shape" },
                values: new object[] { "[]", true, "file" });

            migrationBuilder.UpdateData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "person",
                columns: new[] { "allowed_child_kind_codes", "is_leaf", "storage_shape" },
                values: new object[] { "[]", false, "none" });

            migrationBuilder.UpdateData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "studio",
                columns: new[] { "allowed_child_kind_codes", "is_leaf", "storage_shape" },
                values: new object[] { "[\"studio\"]", false, "none" });

            migrationBuilder.UpdateData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "tag",
                columns: new[] { "allowed_child_kind_codes", "is_leaf", "storage_shape" },
                values: new object[] { "[\"tag\"]", false, "none" });

            migrationBuilder.UpdateData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "video",
                columns: new[] { "allowed_child_kind_codes", "is_leaf", "storage_shape" },
                values: new object[] { "[]", true, "file" });

            migrationBuilder.UpdateData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "video-season",
                columns: new[] { "allowed_child_kind_codes", "is_leaf", "storage_shape" },
                values: new object[] { "[\"video\"]", false, "folder" });

            migrationBuilder.UpdateData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "video-series",
                columns: new[] { "allowed_child_kind_codes", "is_leaf", "storage_shape" },
                values: new object[] { "[\"video-season\",\"video\"]", false, "folder" });

            migrationBuilder.CreateIndex(
                name: "IX_entities_parent_entity_id",
                schema: "v2",
                table: "entities",
                column: "parent_entity_id");

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

            migrationBuilder.AddForeignKey(
                name: "FK_entities_entities_parent_entity_id",
                schema: "v2",
                table: "entities",
                column: "parent_entity_id",
                principalSchema: "v2",
                principalTable: "entities",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_entities_entities_parent_entity_id",
                schema: "v2",
                table: "entities");

            migrationBuilder.DropTable(
                name: "entity_child_links",
                schema: "v2");

            migrationBuilder.DropIndex(
                name: "IX_entities_parent_entity_id",
                schema: "v2",
                table: "entities");

            migrationBuilder.DropColumn(
                name: "allowed_child_kind_codes",
                schema: "v2",
                table: "entity_kinds");

            migrationBuilder.DropColumn(
                name: "is_leaf",
                schema: "v2",
                table: "entity_kinds");

            migrationBuilder.DropColumn(
                name: "storage_shape",
                schema: "v2",
                table: "entity_kinds");

            migrationBuilder.DropColumn(
                name: "parent_entity_id",
                schema: "v2",
                table: "entities");

            migrationBuilder.DropColumn(
                name: "sort_order",
                schema: "v2",
                table: "entities");
        }
    }
}
