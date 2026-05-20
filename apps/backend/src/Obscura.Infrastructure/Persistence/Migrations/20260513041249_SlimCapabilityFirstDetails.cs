using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Obscura.Infrastructure.Persistence.Migrations {
    /// <inheritdoc />
    public partial class SlimCapabilityFirstDetails : Migration {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder) {
            migrationBuilder.DropForeignKey(
                name: "FK_book_details_library_roots_library_root_id",
                schema: "v2",
                table: "book_details");

            migrationBuilder.DropForeignKey(
                name: "FK_video_series_details_library_roots_library_root_id",
                schema: "v2",
                table: "video_series_details");

            migrationBuilder.DropTable(
                name: "book_read_progress",
                schema: "v2");

            migrationBuilder.DropIndex(
                name: "IX_video_series_details_folder_path",
                schema: "v2",
                table: "video_series_details");

            migrationBuilder.DropIndex(
                name: "IX_video_series_details_library_root_id",
                schema: "v2",
                table: "video_series_details");

            migrationBuilder.DropIndex(
                name: "IX_image_details_file_path",
                schema: "v2",
                table: "image_details");

            migrationBuilder.DropIndex(
                name: "IX_gallery_details_folder_path",
                schema: "v2",
                table: "gallery_details");

            migrationBuilder.DropIndex(
                name: "IX_gallery_details_zip_file_path",
                schema: "v2",
                table: "gallery_details");

            migrationBuilder.DropIndex(
                name: "IX_book_volume_details_book_entity_id_volume_number",
                schema: "v2",
                table: "book_volume_details");

            migrationBuilder.DropIndex(
                name: "IX_book_page_details_chapter_entity_id_sort_order",
                schema: "v2",
                table: "book_page_details");

            migrationBuilder.DropIndex(
                name: "IX_book_page_details_file_path",
                schema: "v2",
                table: "book_page_details");

            migrationBuilder.DropIndex(
                name: "IX_book_details_library_root_id_relative_path",
                schema: "v2",
                table: "book_details");

            migrationBuilder.DropIndex(
                name: "IX_book_chapter_details_archive_path",
                schema: "v2",
                table: "book_chapter_details");

            migrationBuilder.DropIndex(
                name: "IX_book_chapter_details_book_entity_id_chapter_number",
                schema: "v2",
                table: "book_chapter_details");

            migrationBuilder.DropIndex(
                name: "IX_audio_library_details_folder_path",
                schema: "v2",
                table: "audio_library_details");

            migrationBuilder.DropColumn(
                name: "content_rating",
                schema: "v2",
                table: "video_series_details");

            migrationBuilder.DropColumn(
                name: "end_air_date",
                schema: "v2",
                table: "video_series_details");

            migrationBuilder.DropColumn(
                name: "first_air_date",
                schema: "v2",
                table: "video_series_details");

            migrationBuilder.DropColumn(
                name: "folder_path",
                schema: "v2",
                table: "video_series_details");

            migrationBuilder.DropColumn(
                name: "library_root_id",
                schema: "v2",
                table: "video_series_details");

            migrationBuilder.DropColumn(
                name: "original_title",
                schema: "v2",
                table: "video_series_details");

            migrationBuilder.DropColumn(
                name: "overview",
                schema: "v2",
                table: "video_series_details");

            migrationBuilder.DropColumn(
                name: "relative_path",
                schema: "v2",
                table: "video_series_details");

            migrationBuilder.DropColumn(
                name: "sort_title",
                schema: "v2",
                table: "video_series_details");

            migrationBuilder.DropColumn(
                name: "tagline",
                schema: "v2",
                table: "video_series_details");

            migrationBuilder.DropColumn(
                name: "air_date",
                schema: "v2",
                table: "video_season_details");

            migrationBuilder.DropColumn(
                name: "folder_path",
                schema: "v2",
                table: "video_season_details");

            migrationBuilder.DropColumn(
                name: "overview",
                schema: "v2",
                table: "video_season_details");

            migrationBuilder.DropColumn(
                name: "bit_rate",
                schema: "v2",
                table: "video_details");

            migrationBuilder.DropColumn(
                name: "codec",
                schema: "v2",
                table: "video_details");

            migrationBuilder.DropColumn(
                name: "container",
                schema: "v2",
                table: "video_details");

            migrationBuilder.DropColumn(
                name: "content_rating",
                schema: "v2",
                table: "video_details");

            migrationBuilder.DropColumn(
                name: "duration_ms",
                schema: "v2",
                table: "video_details");

            migrationBuilder.DropColumn(
                name: "frame_rate",
                schema: "v2",
                table: "video_details");

            migrationBuilder.DropColumn(
                name: "height",
                schema: "v2",
                table: "video_details");

            migrationBuilder.DropColumn(
                name: "original_title",
                schema: "v2",
                table: "video_details");

            migrationBuilder.DropColumn(
                name: "release_date",
                schema: "v2",
                table: "video_details");

            migrationBuilder.DropColumn(
                name: "sort_title",
                schema: "v2",
                table: "video_details");

            migrationBuilder.DropColumn(
                name: "summary",
                schema: "v2",
                table: "video_details");

            migrationBuilder.DropColumn(
                name: "tagline",
                schema: "v2",
                table: "video_details");

            migrationBuilder.DropColumn(
                name: "width",
                schema: "v2",
                table: "video_details");

            migrationBuilder.DropColumn(
                name: "description",
                schema: "v2",
                table: "tag_details");

            migrationBuilder.DropColumn(
                name: "description",
                schema: "v2",
                table: "studio_details");

            migrationBuilder.DropColumn(
                name: "birthdate",
                schema: "v2",
                table: "person_details");

            migrationBuilder.DropColumn(
                name: "career_end",
                schema: "v2",
                table: "person_details");

            migrationBuilder.DropColumn(
                name: "career_start",
                schema: "v2",
                table: "person_details");

            migrationBuilder.DropColumn(
                name: "details",
                schema: "v2",
                table: "person_details");

            migrationBuilder.DropColumn(
                name: "date",
                schema: "v2",
                table: "image_details");

            migrationBuilder.DropColumn(
                name: "details",
                schema: "v2",
                table: "image_details");

            migrationBuilder.DropColumn(
                name: "file_path",
                schema: "v2",
                table: "image_details");

            migrationBuilder.DropColumn(
                name: "file_size_bytes",
                schema: "v2",
                table: "image_details");

            migrationBuilder.DropColumn(
                name: "format",
                schema: "v2",
                table: "image_details");

            migrationBuilder.DropColumn(
                name: "height",
                schema: "v2",
                table: "image_details");

            migrationBuilder.DropColumn(
                name: "sort_order",
                schema: "v2",
                table: "image_details");

            migrationBuilder.DropColumn(
                name: "width",
                schema: "v2",
                table: "image_details");

            migrationBuilder.DropColumn(
                name: "date",
                schema: "v2",
                table: "gallery_details");

            migrationBuilder.DropColumn(
                name: "details",
                schema: "v2",
                table: "gallery_details");

            migrationBuilder.DropColumn(
                name: "folder_path",
                schema: "v2",
                table: "gallery_details");

            migrationBuilder.DropColumn(
                name: "image_count",
                schema: "v2",
                table: "gallery_details");

            migrationBuilder.DropColumn(
                name: "zip_file_path",
                schema: "v2",
                table: "gallery_details");

            migrationBuilder.DropColumn(
                name: "cover_image_path",
                schema: "v2",
                table: "collection_details");

            migrationBuilder.DropColumn(
                name: "description",
                schema: "v2",
                table: "collection_details");

            migrationBuilder.DropColumn(
                name: "item_count",
                schema: "v2",
                table: "collection_details");

            migrationBuilder.DropColumn(
                name: "cover_image_path",
                schema: "v2",
                table: "book_volume_details");

            migrationBuilder.DropColumn(
                name: "folder_path",
                schema: "v2",
                table: "book_volume_details");

            migrationBuilder.DropColumn(
                name: "relative_path",
                schema: "v2",
                table: "book_volume_details");

            migrationBuilder.DropColumn(
                name: "volume_number",
                schema: "v2",
                table: "book_volume_details");

            migrationBuilder.DropColumn(
                name: "file_path",
                schema: "v2",
                table: "book_page_details");

            migrationBuilder.DropColumn(
                name: "file_size_bytes",
                schema: "v2",
                table: "book_page_details");

            migrationBuilder.DropColumn(
                name: "format",
                schema: "v2",
                table: "book_page_details");

            migrationBuilder.DropColumn(
                name: "height",
                schema: "v2",
                table: "book_page_details");

            migrationBuilder.DropColumn(
                name: "sort_order",
                schema: "v2",
                table: "book_page_details");

            migrationBuilder.DropColumn(
                name: "width",
                schema: "v2",
                table: "book_page_details");

            migrationBuilder.DropColumn(
                name: "chapter_count",
                schema: "v2",
                table: "book_details");

            migrationBuilder.DropColumn(
                name: "cover_image_path",
                schema: "v2",
                table: "book_details");

            migrationBuilder.DropColumn(
                name: "date",
                schema: "v2",
                table: "book_details");

            migrationBuilder.DropColumn(
                name: "folder_path",
                schema: "v2",
                table: "book_details");

            migrationBuilder.DropColumn(
                name: "library_root_id",
                schema: "v2",
                table: "book_details");

            migrationBuilder.DropColumn(
                name: "page_count",
                schema: "v2",
                table: "book_details");

            migrationBuilder.DropColumn(
                name: "relative_path",
                schema: "v2",
                table: "book_details");

            migrationBuilder.DropColumn(
                name: "sort_title",
                schema: "v2",
                table: "book_details");

            migrationBuilder.DropColumn(
                name: "summary",
                schema: "v2",
                table: "book_details");

            migrationBuilder.DropColumn(
                name: "archive_path",
                schema: "v2",
                table: "book_chapter_details");

            migrationBuilder.DropColumn(
                name: "chapter_number",
                schema: "v2",
                table: "book_chapter_details");

            migrationBuilder.DropColumn(
                name: "page_count",
                schema: "v2",
                table: "book_chapter_details");

            migrationBuilder.DropColumn(
                name: "relative_path",
                schema: "v2",
                table: "book_chapter_details");

            migrationBuilder.DropColumn(
                name: "bit_rate",
                schema: "v2",
                table: "audio_track_details");

            migrationBuilder.DropColumn(
                name: "channels",
                schema: "v2",
                table: "audio_track_details");

            migrationBuilder.DropColumn(
                name: "codec",
                schema: "v2",
                table: "audio_track_details");

            migrationBuilder.DropColumn(
                name: "container",
                schema: "v2",
                table: "audio_track_details");

            migrationBuilder.DropColumn(
                name: "date",
                schema: "v2",
                table: "audio_track_details");

            migrationBuilder.DropColumn(
                name: "details",
                schema: "v2",
                table: "audio_track_details");

            migrationBuilder.DropColumn(
                name: "duration_seconds",
                schema: "v2",
                table: "audio_track_details");

            migrationBuilder.DropColumn(
                name: "sample_rate",
                schema: "v2",
                table: "audio_track_details");

            migrationBuilder.DropColumn(
                name: "track_number",
                schema: "v2",
                table: "audio_track_details");

            migrationBuilder.DropColumn(
                name: "waveform_path",
                schema: "v2",
                table: "audio_track_details");

            migrationBuilder.DropColumn(
                name: "date",
                schema: "v2",
                table: "audio_library_details");

            migrationBuilder.DropColumn(
                name: "details",
                schema: "v2",
                table: "audio_library_details");

            migrationBuilder.DropColumn(
                name: "folder_path",
                schema: "v2",
                table: "audio_library_details");

            migrationBuilder.DropColumn(
                name: "track_count",
                schema: "v2",
                table: "audio_library_details");

            migrationBuilder.CreateIndex(
                name: "IX_book_volume_details_book_entity_id",
                schema: "v2",
                table: "book_volume_details",
                column: "book_entity_id");

            migrationBuilder.CreateIndex(
                name: "IX_book_page_details_chapter_entity_id",
                schema: "v2",
                table: "book_page_details",
                column: "chapter_entity_id");

            migrationBuilder.CreateIndex(
                name: "IX_book_chapter_details_book_entity_id",
                schema: "v2",
                table: "book_chapter_details",
                column: "book_entity_id");

        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder) {
            migrationBuilder.DropIndex(
                name: "IX_book_volume_details_book_entity_id",
                schema: "v2",
                table: "book_volume_details");

            migrationBuilder.DropIndex(
                name: "IX_book_page_details_chapter_entity_id",
                schema: "v2",
                table: "book_page_details");

            migrationBuilder.DropIndex(
                name: "IX_book_chapter_details_book_entity_id",
                schema: "v2",
                table: "book_chapter_details");

            migrationBuilder.AddColumn<string>(
                name: "content_rating",
                schema: "v2",
                table: "video_series_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "end_air_date",
                schema: "v2",
                table: "video_series_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "first_air_date",
                schema: "v2",
                table: "video_series_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "folder_path",
                schema: "v2",
                table: "video_series_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "library_root_id",
                schema: "v2",
                table: "video_series_details",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "original_title",
                schema: "v2",
                table: "video_series_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "overview",
                schema: "v2",
                table: "video_series_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "relative_path",
                schema: "v2",
                table: "video_series_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "sort_title",
                schema: "v2",
                table: "video_series_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "tagline",
                schema: "v2",
                table: "video_series_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "air_date",
                schema: "v2",
                table: "video_season_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "folder_path",
                schema: "v2",
                table: "video_season_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "overview",
                schema: "v2",
                table: "video_season_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "bit_rate",
                schema: "v2",
                table: "video_details",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "codec",
                schema: "v2",
                table: "video_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "container",
                schema: "v2",
                table: "video_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "content_rating",
                schema: "v2",
                table: "video_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "duration_ms",
                schema: "v2",
                table: "video_details",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "frame_rate",
                schema: "v2",
                table: "video_details",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "height",
                schema: "v2",
                table: "video_details",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "original_title",
                schema: "v2",
                table: "video_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "release_date",
                schema: "v2",
                table: "video_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "sort_title",
                schema: "v2",
                table: "video_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "summary",
                schema: "v2",
                table: "video_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "tagline",
                schema: "v2",
                table: "video_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "width",
                schema: "v2",
                table: "video_details",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "description",
                schema: "v2",
                table: "tag_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "description",
                schema: "v2",
                table: "studio_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "birthdate",
                schema: "v2",
                table: "person_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "career_end",
                schema: "v2",
                table: "person_details",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "career_start",
                schema: "v2",
                table: "person_details",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "details",
                schema: "v2",
                table: "person_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "date",
                schema: "v2",
                table: "image_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "details",
                schema: "v2",
                table: "image_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "file_path",
                schema: "v2",
                table: "image_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "file_size_bytes",
                schema: "v2",
                table: "image_details",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "format",
                schema: "v2",
                table: "image_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "height",
                schema: "v2",
                table: "image_details",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "sort_order",
                schema: "v2",
                table: "image_details",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "width",
                schema: "v2",
                table: "image_details",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "date",
                schema: "v2",
                table: "gallery_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "details",
                schema: "v2",
                table: "gallery_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "folder_path",
                schema: "v2",
                table: "gallery_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "image_count",
                schema: "v2",
                table: "gallery_details",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "zip_file_path",
                schema: "v2",
                table: "gallery_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "cover_image_path",
                schema: "v2",
                table: "collection_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "description",
                schema: "v2",
                table: "collection_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "item_count",
                schema: "v2",
                table: "collection_details",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "cover_image_path",
                schema: "v2",
                table: "book_volume_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "folder_path",
                schema: "v2",
                table: "book_volume_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "relative_path",
                schema: "v2",
                table: "book_volume_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "volume_number",
                schema: "v2",
                table: "book_volume_details",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "file_path",
                schema: "v2",
                table: "book_page_details",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<long>(
                name: "file_size_bytes",
                schema: "v2",
                table: "book_page_details",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "format",
                schema: "v2",
                table: "book_page_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "height",
                schema: "v2",
                table: "book_page_details",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "sort_order",
                schema: "v2",
                table: "book_page_details",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "width",
                schema: "v2",
                table: "book_page_details",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "chapter_count",
                schema: "v2",
                table: "book_details",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "cover_image_path",
                schema: "v2",
                table: "book_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "date",
                schema: "v2",
                table: "book_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "folder_path",
                schema: "v2",
                table: "book_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "library_root_id",
                schema: "v2",
                table: "book_details",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "page_count",
                schema: "v2",
                table: "book_details",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "relative_path",
                schema: "v2",
                table: "book_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "sort_title",
                schema: "v2",
                table: "book_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "summary",
                schema: "v2",
                table: "book_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "archive_path",
                schema: "v2",
                table: "book_chapter_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "chapter_number",
                schema: "v2",
                table: "book_chapter_details",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "page_count",
                schema: "v2",
                table: "book_chapter_details",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "relative_path",
                schema: "v2",
                table: "book_chapter_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "bit_rate",
                schema: "v2",
                table: "audio_track_details",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "channels",
                schema: "v2",
                table: "audio_track_details",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "codec",
                schema: "v2",
                table: "audio_track_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "container",
                schema: "v2",
                table: "audio_track_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "date",
                schema: "v2",
                table: "audio_track_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "details",
                schema: "v2",
                table: "audio_track_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "duration_seconds",
                schema: "v2",
                table: "audio_track_details",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "sample_rate",
                schema: "v2",
                table: "audio_track_details",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "track_number",
                schema: "v2",
                table: "audio_track_details",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "waveform_path",
                schema: "v2",
                table: "audio_track_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "date",
                schema: "v2",
                table: "audio_library_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "details",
                schema: "v2",
                table: "audio_library_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "folder_path",
                schema: "v2",
                table: "audio_library_details",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "track_count",
                schema: "v2",
                table: "audio_library_details",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "book_read_progress",
                schema: "v2",
                columns: table => new {
                    book_entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    chapter_entity_id = table.Column<Guid>(type: "uuid", nullable: true),
                    completed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    page_count = table.Column<int>(type: "integer", nullable: false),
                    page_index = table.Column<int>(type: "integer", nullable: false),
                    reader_mode = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_book_read_progress", x => x.book_entity_id);
                    table.ForeignKey(
                        name: "FK_book_read_progress_entities_book_entity_id",
                        column: x => x.book_entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_video_series_details_folder_path",
                schema: "v2",
                table: "video_series_details",
                column: "folder_path",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_video_series_details_library_root_id",
                schema: "v2",
                table: "video_series_details",
                column: "library_root_id");

            migrationBuilder.CreateIndex(
                name: "IX_image_details_file_path",
                schema: "v2",
                table: "image_details",
                column: "file_path",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_gallery_details_folder_path",
                schema: "v2",
                table: "gallery_details",
                column: "folder_path");

            migrationBuilder.CreateIndex(
                name: "IX_gallery_details_zip_file_path",
                schema: "v2",
                table: "gallery_details",
                column: "zip_file_path");

            migrationBuilder.CreateIndex(
                name: "IX_book_volume_details_book_entity_id_volume_number",
                schema: "v2",
                table: "book_volume_details",
                columns: new[] { "book_entity_id", "volume_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_book_page_details_chapter_entity_id_sort_order",
                schema: "v2",
                table: "book_page_details",
                columns: new[] { "chapter_entity_id", "sort_order" });

            migrationBuilder.CreateIndex(
                name: "IX_book_page_details_file_path",
                schema: "v2",
                table: "book_page_details",
                column: "file_path",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_book_details_library_root_id_relative_path",
                schema: "v2",
                table: "book_details",
                columns: new[] { "library_root_id", "relative_path" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_book_chapter_details_archive_path",
                schema: "v2",
                table: "book_chapter_details",
                column: "archive_path",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_book_chapter_details_book_entity_id_chapter_number",
                schema: "v2",
                table: "book_chapter_details",
                columns: new[] { "book_entity_id", "chapter_number" });

            migrationBuilder.CreateIndex(
                name: "IX_audio_library_details_folder_path",
                schema: "v2",
                table: "audio_library_details",
                column: "folder_path",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_book_details_library_roots_library_root_id",
                schema: "v2",
                table: "book_details",
                column: "library_root_id",
                principalSchema: "v2",
                principalTable: "library_roots",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_video_series_details_library_roots_library_root_id",
                schema: "v2",
                table: "video_series_details",
                column: "library_root_id",
                principalSchema: "v2",
                principalTable: "library_roots",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
