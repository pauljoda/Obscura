using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Obscura.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddGenericEntityHierarchy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                schema: "v2",
                table: "entity_kinds",
                columns: new[] { "code", "category", "display_name" },
                values: new object[,]
                {
                    { "book-chapter", "Media", "Book Chapter" },
                    { "book-page", "Media", "Book Page" },
                    { "book-volume", "Media", "Book Volume" },
                    { "video-season", "Media", "Video Season" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_entity_hierarchy_links_child_entity_id_relationship",
                schema: "v2",
                table: "entity_hierarchy_links",
                columns: new[] { "child_entity_id", "relationship" },
                unique: true,
                filter: "relationship IN ('episode', 'season', 'gallery', 'image', 'audio-library', 'audio-track', 'volume', 'chapter', 'page', 'tag', 'studio')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_entity_hierarchy_links_child_entity_id_relationship",
                schema: "v2",
                table: "entity_hierarchy_links");

            migrationBuilder.DeleteData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "book-chapter");

            migrationBuilder.DeleteData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "book-page");

            migrationBuilder.DeleteData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "book-volume");

            migrationBuilder.DeleteData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "video-season");
        }
    }
}
