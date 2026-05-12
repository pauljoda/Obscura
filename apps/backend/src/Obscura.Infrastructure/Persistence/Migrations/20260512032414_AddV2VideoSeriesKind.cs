using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Obscura.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddV2VideoSeriesKind : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                schema: "v2",
                table: "entity_kinds",
                columns: new[] { "code", "category", "display_name" },
                values: new object[] { "video-series", "Media", "Video Series" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "video-series");
        }
    }
}
