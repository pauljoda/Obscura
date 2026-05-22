using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Obscura.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddHdrPlaybackMetadata : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "bit_depth",
                schema: "v2",
                table: "media_streams",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "bl_present_flag",
                schema: "v2",
                table: "media_streams",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "color_primaries",
                schema: "v2",
                table: "media_streams",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "color_range",
                schema: "v2",
                table: "media_streams",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "color_space",
                schema: "v2",
                table: "media_streams",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "color_transfer",
                schema: "v2",
                table: "media_streams",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "dv_bl_signal_compatibility_id",
                schema: "v2",
                table: "media_streams",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "dv_level",
                schema: "v2",
                table: "media_streams",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "dv_profile",
                schema: "v2",
                table: "media_streams",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "el_present_flag",
                schema: "v2",
                table: "media_streams",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "hdr10_plus_present_flag",
                schema: "v2",
                table: "media_streams",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "pixel_format",
                schema: "v2",
                table: "media_streams",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "rpu_present_flag",
                schema: "v2",
                table: "media_streams",
                type: "boolean",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "bit_depth",
                schema: "v2",
                table: "media_streams");

            migrationBuilder.DropColumn(
                name: "bl_present_flag",
                schema: "v2",
                table: "media_streams");

            migrationBuilder.DropColumn(
                name: "color_primaries",
                schema: "v2",
                table: "media_streams");

            migrationBuilder.DropColumn(
                name: "color_range",
                schema: "v2",
                table: "media_streams");

            migrationBuilder.DropColumn(
                name: "color_space",
                schema: "v2",
                table: "media_streams");

            migrationBuilder.DropColumn(
                name: "color_transfer",
                schema: "v2",
                table: "media_streams");

            migrationBuilder.DropColumn(
                name: "dv_bl_signal_compatibility_id",
                schema: "v2",
                table: "media_streams");

            migrationBuilder.DropColumn(
                name: "dv_level",
                schema: "v2",
                table: "media_streams");

            migrationBuilder.DropColumn(
                name: "dv_profile",
                schema: "v2",
                table: "media_streams");

            migrationBuilder.DropColumn(
                name: "el_present_flag",
                schema: "v2",
                table: "media_streams");

            migrationBuilder.DropColumn(
                name: "hdr10_plus_present_flag",
                schema: "v2",
                table: "media_streams");

            migrationBuilder.DropColumn(
                name: "pixel_format",
                schema: "v2",
                table: "media_streams");

            migrationBuilder.DropColumn(
                name: "rpu_present_flag",
                schema: "v2",
                table: "media_streams");
        }
    }
}
