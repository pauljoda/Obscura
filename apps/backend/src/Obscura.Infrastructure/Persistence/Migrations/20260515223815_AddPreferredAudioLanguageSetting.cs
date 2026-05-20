using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Obscura.Infrastructure.Persistence.Migrations {
    /// <inheritdoc />
    public partial class AddPreferredAudioLanguageSetting : Migration {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder) {
            migrationBuilder.AddColumn<string>(
                name: "audio_preferred_languages",
                schema: "v2",
                table: "library_settings",
                type: "text",
                nullable: false,
                defaultValue: "en,eng,en-US");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder) {
            migrationBuilder.DropColumn(
                name: "audio_preferred_languages",
                schema: "v2",
                table: "library_settings");
        }
    }
}
