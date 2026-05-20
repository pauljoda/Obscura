using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Obscura.Infrastructure.Persistence.Migrations {
    /// <inheritdoc />
    public partial class AlignEntityKindSeedMetadata : Migration {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder) {
            migrationBuilder.UpdateData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "book",
                column: "is_leaf",
                value: false);

            migrationBuilder.UpdateData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "collection",
                column: "allowed_child_kind_codes",
                value: "[\"audio\",\"audio-library\",\"audio-track\",\"book\",\"book-volume\",\"book-chapter\",\"book-page\",\"collection\",\"gallery\",\"image\",\"person\",\"studio\",\"tag\",\"video\",\"video-series\",\"video-season\"]");

            migrationBuilder.UpdateData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "person",
                column: "is_leaf",
                value: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder) {
            migrationBuilder.UpdateData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "book",
                column: "is_leaf",
                value: true);

            migrationBuilder.UpdateData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "collection",
                column: "allowed_child_kind_codes",
                value: "[\"audio\",\"audio-library\",\"audio-track\",\"book\",\"book-chapter\",\"book-page\",\"book-volume\",\"collection\",\"gallery\",\"image\",\"person\",\"studio\",\"tag\",\"video\",\"video-season\",\"video-series\"]");

            migrationBuilder.UpdateData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "person",
                column: "is_leaf",
                value: false);
        }
    }
}
