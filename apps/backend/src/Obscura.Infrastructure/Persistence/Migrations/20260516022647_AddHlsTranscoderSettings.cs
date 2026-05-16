using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Obscura.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddHlsTranscoderSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "hls_ffmpeg_path",
                schema: "v2",
                table: "library_settings",
                type: "text",
                nullable: false,
                defaultValue: "ffmpeg");

            migrationBuilder.AddColumn<string>(
                name: "hls_transcoder_profile",
                schema: "v2",
                table: "library_settings",
                type: "text",
                nullable: false,
                defaultValue: "Software");

            migrationBuilder.AddColumn<string>(
                name: "hls_vaapi_device",
                schema: "v2",
                table: "library_settings",
                type: "text",
                nullable: false,
                defaultValue: "/dev/dri/renderD128");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "hls_ffmpeg_path",
                schema: "v2",
                table: "library_settings");

            migrationBuilder.DropColumn(
                name: "hls_transcoder_profile",
                schema: "v2",
                table: "library_settings");

            migrationBuilder.DropColumn(
                name: "hls_vaapi_device",
                schema: "v2",
                table: "library_settings");
        }
    }
}
