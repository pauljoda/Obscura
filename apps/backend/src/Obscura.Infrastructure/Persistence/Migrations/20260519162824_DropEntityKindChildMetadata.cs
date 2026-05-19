using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Obscura.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class DropEntityKindChildMetadata : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "allowed_child_kind_codes",
                schema: "v2",
                table: "entity_kinds");

            migrationBuilder.DropColumn(
                name: "is_leaf",
                schema: "v2",
                table: "entity_kinds");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "allowed_child_kind_codes",
                schema: "v2",
                table: "entity_kinds",
                type: "jsonb",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "is_leaf",
                schema: "v2",
                table: "entity_kinds",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.UpdateData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "audio",
                columns: new[] { "allowed_child_kind_codes", "is_leaf" },
                values: new object[] { "[]", true });

            migrationBuilder.UpdateData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "audio-library",
                columns: new[] { "allowed_child_kind_codes", "is_leaf" },
                values: new object[] { "[\"audio-library\",\"audio-track\"]", false });

            migrationBuilder.UpdateData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "audio-track",
                columns: new[] { "allowed_child_kind_codes", "is_leaf" },
                values: new object[] { "[]", true });

            migrationBuilder.UpdateData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "book",
                columns: new[] { "allowed_child_kind_codes", "is_leaf" },
                values: new object[] { "[\"book-volume\",\"book-chapter\",\"book-page\"]", false });

            migrationBuilder.UpdateData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "book-chapter",
                columns: new[] { "allowed_child_kind_codes", "is_leaf" },
                values: new object[] { "[\"book-page\"]", false });

            migrationBuilder.UpdateData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "book-page",
                columns: new[] { "allowed_child_kind_codes", "is_leaf" },
                values: new object[] { "[]", true });

            migrationBuilder.UpdateData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "book-volume",
                columns: new[] { "allowed_child_kind_codes", "is_leaf" },
                values: new object[] { "[\"book-chapter\",\"book-page\"]", false });

            migrationBuilder.UpdateData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "collection",
                columns: new[] { "allowed_child_kind_codes", "is_leaf" },
                values: new object[] { "[\"audio\",\"audio-library\",\"audio-track\",\"book\",\"book-volume\",\"book-chapter\",\"book-page\",\"collection\",\"gallery\",\"image\",\"person\",\"studio\",\"tag\",\"video\",\"video-series\",\"video-season\"]", false });

            migrationBuilder.UpdateData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "gallery",
                columns: new[] { "allowed_child_kind_codes", "is_leaf" },
                values: new object[] { "[\"gallery\",\"image\"]", false });

            migrationBuilder.UpdateData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "image",
                columns: new[] { "allowed_child_kind_codes", "is_leaf" },
                values: new object[] { "[]", true });

            migrationBuilder.UpdateData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "person",
                columns: new[] { "allowed_child_kind_codes", "is_leaf" },
                values: new object[] { "[]", true });

            migrationBuilder.UpdateData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "studio",
                columns: new[] { "allowed_child_kind_codes", "is_leaf" },
                values: new object[] { "[\"studio\"]", false });

            migrationBuilder.UpdateData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "tag",
                columns: new[] { "allowed_child_kind_codes", "is_leaf" },
                values: new object[] { "[\"tag\"]", false });

            migrationBuilder.UpdateData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "video",
                columns: new[] { "allowed_child_kind_codes", "is_leaf" },
                values: new object[] { "[]", true });

            migrationBuilder.UpdateData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "video-season",
                columns: new[] { "allowed_child_kind_codes", "is_leaf" },
                values: new object[] { "[\"video\"]", false });

            migrationBuilder.UpdateData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "video-series",
                columns: new[] { "allowed_child_kind_codes", "is_leaf" },
                values: new object[] { "[\"video-season\",\"video\"]", false });
        }
    }
}
