using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Obscura.Infrastructure.Persistence.Migrations {
    /// <inheritdoc />
    public partial class AddExpandedV2DataModel : Migration {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder) {
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

            migrationBuilder.AddColumn<double>(
                name: "frame_rate",
                schema: "v2",
                table: "video_details",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "library_root_id",
                schema: "v2",
                table: "video_details",
                type: "uuid",
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

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "subtitles_extracted_at",
                schema: "v2",
                table: "video_details",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "tagline",
                schema: "v2",
                table: "video_details",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "audio_library_details",
                schema: "v2",
                columns: table => new {
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    details = table.Column<string>(type: "text", nullable: true),
                    date = table.Column<string>(type: "text", nullable: true),
                    folder_path = table.Column<string>(type: "text", nullable: true),
                    parent_library_entity_id = table.Column<Guid>(type: "uuid", nullable: true),
                    track_count = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_audio_library_details", x => x.entity_id);
                    table.ForeignKey(
                        name: "FK_audio_library_details_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "audio_track_details",
                schema: "v2",
                columns: table => new {
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    details = table.Column<string>(type: "text", nullable: true),
                    date = table.Column<string>(type: "text", nullable: true),
                    duration_seconds = table.Column<double>(type: "double precision", nullable: true),
                    bit_rate = table.Column<int>(type: "integer", nullable: true),
                    sample_rate = table.Column<int>(type: "integer", nullable: true),
                    channels = table.Column<int>(type: "integer", nullable: true),
                    codec = table.Column<string>(type: "text", nullable: true),
                    container = table.Column<string>(type: "text", nullable: true),
                    embedded_artist = table.Column<string>(type: "text", nullable: true),
                    embedded_album = table.Column<string>(type: "text", nullable: true),
                    track_number = table.Column<int>(type: "integer", nullable: true),
                    waveform_path = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table => {
                    table.PrimaryKey("PK_audio_track_details", x => x.entity_id);
                    table.ForeignKey(
                        name: "FK_audio_track_details_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "book_chapter_details",
                schema: "v2",
                columns: table => new {
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    book_entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    volume_entity_id = table.Column<Guid>(type: "uuid", nullable: true),
                    chapter_number = table.Column<int>(type: "integer", nullable: false),
                    archive_path = table.Column<string>(type: "text", nullable: true),
                    relative_path = table.Column<string>(type: "text", nullable: true),
                    page_count = table.Column<int>(type: "integer", nullable: false),
                    cover_page_entity_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table => {
                    table.PrimaryKey("PK_book_chapter_details", x => x.entity_id);
                    table.ForeignKey(
                        name: "FK_book_chapter_details_entities_book_entity_id",
                        column: x => x.book_entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_book_chapter_details_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "book_details",
                schema: "v2",
                columns: table => new {
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    library_root_id = table.Column<Guid>(type: "uuid", nullable: true),
                    book_type = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    sort_title = table.Column<string>(type: "text", nullable: true),
                    summary = table.Column<string>(type: "text", nullable: true),
                    date = table.Column<string>(type: "text", nullable: true),
                    folder_path = table.Column<string>(type: "text", nullable: true),
                    relative_path = table.Column<string>(type: "text", nullable: true),
                    cover_page_entity_id = table.Column<Guid>(type: "uuid", nullable: true),
                    cover_image_path = table.Column<string>(type: "text", nullable: true),
                    page_count = table.Column<int>(type: "integer", nullable: false),
                    chapter_count = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_book_details", x => x.entity_id);
                    table.ForeignKey(
                        name: "FK_book_details_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_book_details_library_roots_library_root_id",
                        column: x => x.library_root_id,
                        principalSchema: "v2",
                        principalTable: "library_roots",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "book_page_details",
                schema: "v2",
                columns: table => new {
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    book_entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    chapter_entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    file_path = table.Column<string>(type: "text", nullable: false),
                    file_size_bytes = table.Column<long>(type: "bigint", nullable: true),
                    width = table.Column<int>(type: "integer", nullable: true),
                    height = table.Column<int>(type: "integer", nullable: true),
                    format = table.Column<string>(type: "text", nullable: true),
                    sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_book_page_details", x => x.entity_id);
                    table.ForeignKey(
                        name: "FK_book_page_details_entities_book_entity_id",
                        column: x => x.book_entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_book_page_details_entities_chapter_entity_id",
                        column: x => x.chapter_entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_book_page_details_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "book_read_progress",
                schema: "v2",
                columns: table => new {
                    book_entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    chapter_entity_id = table.Column<Guid>(type: "uuid", nullable: true),
                    page_index = table.Column<int>(type: "integer", nullable: false),
                    page_count = table.Column<int>(type: "integer", nullable: false),
                    reader_mode = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    completed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
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

            migrationBuilder.CreateTable(
                name: "book_volume_details",
                schema: "v2",
                columns: table => new {
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    book_entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    volume_number = table.Column<int>(type: "integer", nullable: true),
                    folder_path = table.Column<string>(type: "text", nullable: true),
                    relative_path = table.Column<string>(type: "text", nullable: true),
                    cover_image_path = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table => {
                    table.PrimaryKey("PK_book_volume_details", x => x.entity_id);
                    table.ForeignKey(
                        name: "FK_book_volume_details_entities_book_entity_id",
                        column: x => x.book_entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_book_volume_details_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "collection_details",
                schema: "v2",
                columns: table => new {
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    mode = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    rule_tree_json = table.Column<string>(type: "jsonb", nullable: true),
                    item_count = table.Column<int>(type: "integer", nullable: false),
                    cover_mode = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    cover_image_path = table.Column<string>(type: "text", nullable: true),
                    cover_item_entity_id = table.Column<Guid>(type: "uuid", nullable: true),
                    slideshow_duration_seconds = table.Column<int>(type: "integer", nullable: false),
                    slideshow_auto_advance = table.Column<bool>(type: "boolean", nullable: false),
                    last_refreshed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table => {
                    table.PrimaryKey("PK_collection_details", x => x.entity_id);
                    table.ForeignKey(
                        name: "FK_collection_details_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "collection_item_details",
                schema: "v2",
                columns: table => new {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    collection_entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    item_entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    source = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    added_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_collection_item_details", x => x.id);
                    table.ForeignKey(
                        name: "FK_collection_item_details_entities_collection_entity_id",
                        column: x => x.collection_entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_collection_item_details_entities_item_entity_id",
                        column: x => x.item_entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "entity_aliases",
                schema: "v2",
                columns: table => new {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    value = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    alias_type = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_entity_aliases", x => x.id);
                    table.ForeignKey(
                        name: "FK_entity_aliases_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "entity_file_fingerprints",
                schema: "v2",
                columns: table => new {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    entity_file_id = table.Column<Guid>(type: "uuid", nullable: true),
                    algorithm = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    value = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_entity_file_fingerprints", x => x.id);
                    table.ForeignKey(
                        name: "FK_entity_file_fingerprints_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_entity_file_fingerprints_entity_files_entity_file_id",
                        column: x => x.entity_file_id,
                        principalSchema: "v2",
                        principalTable: "entity_files",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "entity_playback",
                schema: "v2",
                columns: table => new {
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    play_count = table.Column<int>(type: "integer", nullable: false),
                    play_duration_seconds = table.Column<double>(type: "double precision", nullable: false),
                    resume_seconds = table.Column<double>(type: "double precision", nullable: false),
                    last_played_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    completed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_entity_playback", x => x.entity_id);
                    table.ForeignKey(
                        name: "FK_entity_playback_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "gallery_details",
                schema: "v2",
                columns: table => new {
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    details = table.Column<string>(type: "text", nullable: true),
                    date = table.Column<string>(type: "text", nullable: true),
                    gallery_type = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    folder_path = table.Column<string>(type: "text", nullable: true),
                    zip_file_path = table.Column<string>(type: "text", nullable: true),
                    photographer = table.Column<string>(type: "text", nullable: true),
                    cover_image_entity_id = table.Column<Guid>(type: "uuid", nullable: true),
                    image_count = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_gallery_details", x => x.entity_id);
                    table.ForeignKey(
                        name: "FK_gallery_details_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "image_details",
                schema: "v2",
                columns: table => new {
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    details = table.Column<string>(type: "text", nullable: true),
                    date = table.Column<string>(type: "text", nullable: true),
                    file_path = table.Column<string>(type: "text", nullable: true),
                    file_size_bytes = table.Column<long>(type: "bigint", nullable: true),
                    width = table.Column<int>(type: "integer", nullable: true),
                    height = table.Column<int>(type: "integer", nullable: true),
                    format = table.Column<string>(type: "text", nullable: true),
                    sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_image_details", x => x.entity_id);
                    table.ForeignKey(
                        name: "FK_image_details_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "media_file_ignores",
                schema: "v2",
                columns: table => new {
                    path = table.Column<string>(type: "text", nullable: false),
                    entity_kind_code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    reason = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_media_file_ignores", x => x.path);
                });

            migrationBuilder.CreateTable(
                name: "person_details",
                schema: "v2",
                columns: table => new {
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    disambiguation = table.Column<string>(type: "text", nullable: true),
                    gender = table.Column<string>(type: "text", nullable: true),
                    birthdate = table.Column<string>(type: "text", nullable: true),
                    country = table.Column<string>(type: "text", nullable: true),
                    ethnicity = table.Column<string>(type: "text", nullable: true),
                    eye_color = table.Column<string>(type: "text", nullable: true),
                    hair_color = table.Column<string>(type: "text", nullable: true),
                    height = table.Column<int>(type: "integer", nullable: true),
                    weight = table.Column<int>(type: "integer", nullable: true),
                    measurements = table.Column<string>(type: "text", nullable: true),
                    tattoos = table.Column<string>(type: "text", nullable: true),
                    piercings = table.Column<string>(type: "text", nullable: true),
                    career_start = table.Column<int>(type: "integer", nullable: true),
                    career_end = table.Column<int>(type: "integer", nullable: true),
                    details = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table => {
                    table.PrimaryKey("PK_person_details", x => x.entity_id);
                    table.ForeignKey(
                        name: "FK_person_details_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "provider_configs",
                schema: "v2",
                columns: table => new {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    provider_code = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    display_name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    provider_type = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    settings_json = table.Column<string>(type: "jsonb", nullable: false),
                    enabled = table.Column<bool>(type: "boolean", nullable: false),
                    is_nsfw = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_provider_configs", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "studio_details",
                schema: "v2",
                columns: table => new {
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    parent_studio_entity_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table => {
                    table.PrimaryKey("PK_studio_details", x => x.entity_id);
                    table.ForeignKey(
                        name: "FK_studio_details_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "tag_details",
                schema: "v2",
                columns: table => new {
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    parent_tag_entity_id = table.Column<Guid>(type: "uuid", nullable: true),
                    ignore_auto_tag = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_tag_details", x => x.entity_id);
                    table.ForeignKey(
                        name: "FK_tag_details_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ui_prefs",
                schema: "v2",
                columns: table => new {
                    key = table.Column<string>(type: "text", nullable: false),
                    value_json = table.Column<string>(type: "jsonb", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_ui_prefs", x => x.key);
                });

            migrationBuilder.CreateTable(
                name: "video_season_details",
                schema: "v2",
                columns: table => new {
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    series_entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    season_number = table.Column<int>(type: "integer", nullable: false),
                    folder_path = table.Column<string>(type: "text", nullable: true),
                    overview = table.Column<string>(type: "text", nullable: true),
                    air_date = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table => {
                    table.PrimaryKey("PK_video_season_details", x => x.entity_id);
                    table.ForeignKey(
                        name: "FK_video_season_details_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_video_season_details_entities_series_entity_id",
                        column: x => x.series_entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "video_series_details",
                schema: "v2",
                columns: table => new {
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    library_root_id = table.Column<Guid>(type: "uuid", nullable: true),
                    folder_path = table.Column<string>(type: "text", nullable: true),
                    relative_path = table.Column<string>(type: "text", nullable: true),
                    sort_title = table.Column<string>(type: "text", nullable: true),
                    original_title = table.Column<string>(type: "text", nullable: true),
                    overview = table.Column<string>(type: "text", nullable: true),
                    tagline = table.Column<string>(type: "text", nullable: true),
                    status = table.Column<string>(type: "text", nullable: true),
                    first_air_date = table.Column<string>(type: "text", nullable: true),
                    end_air_date = table.Column<string>(type: "text", nullable: true),
                    content_rating = table.Column<string>(type: "text", nullable: true),
                    rendering_mode = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_video_series_details", x => x.entity_id);
                    table.ForeignKey(
                        name: "FK_video_series_details_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_video_series_details_library_roots_library_root_id",
                        column: x => x.library_root_id,
                        principalSchema: "v2",
                        principalTable: "library_roots",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "fingerprint_submissions",
                schema: "v2",
                columns: table => new {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    provider_config_id = table.Column<Guid>(type: "uuid", nullable: true),
                    algorithm = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    hash = table.Column<string>(type: "text", nullable: false),
                    status = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    error = table.Column<string>(type: "text", nullable: true),
                    submitted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_fingerprint_submissions", x => x.id);
                    table.ForeignKey(
                        name: "FK_fingerprint_submissions_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_fingerprint_submissions_provider_configs_provider_config_id",
                        column: x => x.provider_config_id,
                        principalSchema: "v2",
                        principalTable: "provider_configs",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "identify_results",
                schema: "v2",
                columns: table => new {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    provider_config_id = table.Column<Guid>(type: "uuid", nullable: true),
                    action = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    status = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    match_type = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    raw_result_json = table.Column<string>(type: "jsonb", nullable: true),
                    proposed_result_json = table.Column<string>(type: "jsonb", nullable: true),
                    applied_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_identify_results", x => x.id);
                    table.ForeignKey(
                        name: "FK_identify_results_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_identify_results_provider_configs_provider_config_id",
                        column: x => x.provider_config_id,
                        principalSchema: "v2",
                        principalTable: "provider_configs",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "provider_credentials",
                schema: "v2",
                columns: table => new {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    provider_config_id = table.Column<Guid>(type: "uuid", nullable: false),
                    credential_key = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    encrypted_value = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_provider_credentials", x => x.id);
                    table.ForeignKey(
                        name: "FK_provider_credentials_provider_configs_provider_config_id",
                        column: x => x.provider_config_id,
                        principalSchema: "v2",
                        principalTable: "provider_configs",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_video_details_library_root_id",
                schema: "v2",
                table: "video_details",
                column: "library_root_id");

            migrationBuilder.CreateIndex(
                name: "IX_audio_library_details_folder_path",
                schema: "v2",
                table: "audio_library_details",
                column: "folder_path",
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
                name: "IX_book_details_library_root_id_relative_path",
                schema: "v2",
                table: "book_details",
                columns: new[] { "library_root_id", "relative_path" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_book_page_details_book_entity_id",
                schema: "v2",
                table: "book_page_details",
                column: "book_entity_id");

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
                name: "IX_book_volume_details_book_entity_id_volume_number",
                schema: "v2",
                table: "book_volume_details",
                columns: new[] { "book_entity_id", "volume_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_collection_item_details_collection_entity_id_item_entity_id",
                schema: "v2",
                table: "collection_item_details",
                columns: new[] { "collection_entity_id", "item_entity_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_collection_item_details_item_entity_id",
                schema: "v2",
                table: "collection_item_details",
                column: "item_entity_id");

            migrationBuilder.CreateIndex(
                name: "IX_entity_aliases_entity_id_value",
                schema: "v2",
                table: "entity_aliases",
                columns: new[] { "entity_id", "value" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_entity_file_fingerprints_entity_file_id",
                schema: "v2",
                table: "entity_file_fingerprints",
                column: "entity_file_id");

            migrationBuilder.CreateIndex(
                name: "IX_entity_file_fingerprints_entity_id_algorithm",
                schema: "v2",
                table: "entity_file_fingerprints",
                columns: new[] { "entity_id", "algorithm" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_fingerprint_submissions_entity_id_algorithm_hash",
                schema: "v2",
                table: "fingerprint_submissions",
                columns: new[] { "entity_id", "algorithm", "hash" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_fingerprint_submissions_provider_config_id",
                schema: "v2",
                table: "fingerprint_submissions",
                column: "provider_config_id");

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
                name: "IX_identify_results_entity_id_status",
                schema: "v2",
                table: "identify_results",
                columns: new[] { "entity_id", "status" });

            migrationBuilder.CreateIndex(
                name: "IX_identify_results_provider_config_id",
                schema: "v2",
                table: "identify_results",
                column: "provider_config_id");

            migrationBuilder.CreateIndex(
                name: "IX_image_details_file_path",
                schema: "v2",
                table: "image_details",
                column: "file_path",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_media_file_ignores_entity_kind_code",
                schema: "v2",
                table: "media_file_ignores",
                column: "entity_kind_code");

            migrationBuilder.CreateIndex(
                name: "IX_provider_configs_provider_code",
                schema: "v2",
                table: "provider_configs",
                column: "provider_code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_provider_credentials_provider_config_id_credential_key",
                schema: "v2",
                table: "provider_credentials",
                columns: new[] { "provider_config_id", "credential_key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_video_season_details_series_entity_id_season_number",
                schema: "v2",
                table: "video_season_details",
                columns: new[] { "series_entity_id", "season_number" },
                unique: true);

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

            migrationBuilder.AddForeignKey(
                name: "FK_video_details_library_roots_library_root_id",
                schema: "v2",
                table: "video_details",
                column: "library_root_id",
                principalSchema: "v2",
                principalTable: "library_roots",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder) {
            migrationBuilder.DropForeignKey(
                name: "FK_video_details_library_roots_library_root_id",
                schema: "v2",
                table: "video_details");

            migrationBuilder.DropTable(
                name: "audio_library_details",
                schema: "v2");

            migrationBuilder.DropTable(
                name: "audio_track_details",
                schema: "v2");

            migrationBuilder.DropTable(
                name: "book_chapter_details",
                schema: "v2");

            migrationBuilder.DropTable(
                name: "book_details",
                schema: "v2");

            migrationBuilder.DropTable(
                name: "book_page_details",
                schema: "v2");

            migrationBuilder.DropTable(
                name: "book_read_progress",
                schema: "v2");

            migrationBuilder.DropTable(
                name: "book_volume_details",
                schema: "v2");

            migrationBuilder.DropTable(
                name: "collection_details",
                schema: "v2");

            migrationBuilder.DropTable(
                name: "collection_item_details",
                schema: "v2");

            migrationBuilder.DropTable(
                name: "entity_aliases",
                schema: "v2");

            migrationBuilder.DropTable(
                name: "entity_file_fingerprints",
                schema: "v2");

            migrationBuilder.DropTable(
                name: "entity_playback",
                schema: "v2");

            migrationBuilder.DropTable(
                name: "fingerprint_submissions",
                schema: "v2");

            migrationBuilder.DropTable(
                name: "gallery_details",
                schema: "v2");

            migrationBuilder.DropTable(
                name: "identify_results",
                schema: "v2");

            migrationBuilder.DropTable(
                name: "image_details",
                schema: "v2");

            migrationBuilder.DropTable(
                name: "media_file_ignores",
                schema: "v2");

            migrationBuilder.DropTable(
                name: "person_details",
                schema: "v2");

            migrationBuilder.DropTable(
                name: "provider_credentials",
                schema: "v2");

            migrationBuilder.DropTable(
                name: "studio_details",
                schema: "v2");

            migrationBuilder.DropTable(
                name: "tag_details",
                schema: "v2");

            migrationBuilder.DropTable(
                name: "ui_prefs",
                schema: "v2");

            migrationBuilder.DropTable(
                name: "video_season_details",
                schema: "v2");

            migrationBuilder.DropTable(
                name: "video_series_details",
                schema: "v2");

            migrationBuilder.DropTable(
                name: "provider_configs",
                schema: "v2");

            migrationBuilder.DropIndex(
                name: "IX_video_details_library_root_id",
                schema: "v2",
                table: "video_details");

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
                name: "frame_rate",
                schema: "v2",
                table: "video_details");

            migrationBuilder.DropColumn(
                name: "library_root_id",
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
                name: "subtitles_extracted_at",
                schema: "v2",
                table: "video_details");

            migrationBuilder.DropColumn(
                name: "tagline",
                schema: "v2",
                table: "video_details");
        }
    }
}
