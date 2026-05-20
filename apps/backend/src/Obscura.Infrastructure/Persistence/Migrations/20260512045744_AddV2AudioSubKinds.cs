using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Obscura.Infrastructure.Persistence.Migrations {
    /// <inheritdoc />
    public partial class AddV2AudioSubKinds : Migration {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder) {
            migrationBuilder.InsertData(
                schema: "v2",
                table: "entity_kinds",
                columns: new[] { "code", "category", "display_name" },
                values: new object[,]
                {
                    { "audio-library", "Media", "Audio Library" },
                    { "audio-track", "Media", "Audio Track" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder) {
            migrationBuilder.DeleteData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "audio-library");

            migrationBuilder.DeleteData(
                schema: "v2",
                table: "entity_kinds",
                keyColumn: "code",
                keyValue: "audio-track");
        }
    }
}
