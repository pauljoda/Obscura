CREATE TABLE "book_chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"title" text NOT NULL,
	"chapter_number" integer DEFAULT 1 NOT NULL,
	"archive_path" text NOT NULL,
	"relative_path" text NOT NULL,
	"page_count" integer DEFAULT 0 NOT NULL,
	"cover_page_id" uuid,
	"external_ids" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_legacy_gallery_map" (
	"gallery_id" uuid PRIMARY KEY NOT NULL,
	"book_id" uuid NOT NULL,
	"chapter_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"chapter_id" uuid NOT NULL,
	"title" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" real,
	"width" integer,
	"height" integer,
	"format" text,
	"thumbnail_path" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_nsfw" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_performers" (
	"book_id" uuid NOT NULL,
	"performer_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_read_progress" (
	"book_id" uuid PRIMARY KEY NOT NULL,
	"chapter_id" uuid,
	"page_index" integer DEFAULT 0 NOT NULL,
	"page_count" integer DEFAULT 0 NOT NULL,
	"reader_mode" text DEFAULT 'paged' NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_tags" (
	"book_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"library_root_id" uuid NOT NULL,
	"book_type" text DEFAULT 'comic' NOT NULL,
	"title" text NOT NULL,
	"sort_title" text,
	"details" text,
	"date" text,
	"rating" integer,
	"organized" boolean DEFAULT false NOT NULL,
	"is_nsfw" boolean DEFAULT false NOT NULL,
	"urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"folder_path" text,
	"relative_path" text NOT NULL,
	"cover_page_id" uuid,
	"cover_image_path" text,
	"page_count" integer DEFAULT 0 NOT NULL,
	"chapter_count" integer DEFAULT 0 NOT NULL,
	"external_ids" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"studio_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "library_roots" ADD COLUMN "scan_books" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "book_chapters" ADD CONSTRAINT "book_chapters_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_legacy_gallery_map" ADD CONSTRAINT "book_legacy_gallery_map_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_legacy_gallery_map" ADD CONSTRAINT "book_legacy_gallery_map_chapter_id_book_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."book_chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_pages" ADD CONSTRAINT "book_pages_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_pages" ADD CONSTRAINT "book_pages_chapter_id_book_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."book_chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_performers" ADD CONSTRAINT "book_performers_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_performers" ADD CONSTRAINT "book_performers_performer_id_performers_id_fk" FOREIGN KEY ("performer_id") REFERENCES "public"."performers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_read_progress" ADD CONSTRAINT "book_read_progress_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_read_progress" ADD CONSTRAINT "book_read_progress_chapter_id_book_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."book_chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_tags" ADD CONSTRAINT "book_tags_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_tags" ADD CONSTRAINT "book_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_library_root_id_library_roots_id_fk" FOREIGN KEY ("library_root_id") REFERENCES "public"."library_roots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_studio_id_studios_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "book_chapters_archive_path_idx" ON "book_chapters" USING btree ("archive_path");--> statement-breakpoint
CREATE INDEX "book_chapters_book_idx" ON "book_chapters" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "book_chapters_book_number_idx" ON "book_chapters" USING btree ("book_id","chapter_number");--> statement-breakpoint
CREATE INDEX "book_legacy_gallery_map_book_idx" ON "book_legacy_gallery_map" USING btree ("book_id");--> statement-breakpoint
CREATE UNIQUE INDEX "book_pages_file_path_idx" ON "book_pages" USING btree ("file_path");--> statement-breakpoint
CREATE INDEX "book_pages_book_idx" ON "book_pages" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "book_pages_chapter_idx" ON "book_pages" USING btree ("chapter_id");--> statement-breakpoint
CREATE INDEX "book_pages_chapter_sort_idx" ON "book_pages" USING btree ("chapter_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "book_performers_pk" ON "book_performers" USING btree ("book_id","performer_id");--> statement-breakpoint
CREATE INDEX "book_performers_performer_idx" ON "book_performers" USING btree ("performer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "book_tags_pk" ON "book_tags" USING btree ("book_id","tag_id");--> statement-breakpoint
CREATE INDEX "book_tags_tag_idx" ON "book_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "books_library_root_idx" ON "books" USING btree ("library_root_id");--> statement-breakpoint
CREATE INDEX "books_type_idx" ON "books" USING btree ("book_type");--> statement-breakpoint
CREATE INDEX "books_studio_idx" ON "books" USING btree ("studio_id");--> statement-breakpoint
CREATE INDEX "books_date_idx" ON "books" USING btree ("date");--> statement-breakpoint
CREATE INDEX "books_rating_idx" ON "books" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "books_created_at_idx" ON "books" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "books_folder_path_idx" ON "books" USING btree ("folder_path");--> statement-breakpoint
CREATE UNIQUE INDEX "books_root_relative_idx" ON "books" USING btree ("library_root_id","relative_path");--> statement-breakpoint
WITH archive_galleries AS (
	SELECT DISTINCT ON (g.id)
		g.*,
		lr.id AS library_root_id,
		p.id AS parent_gallery_id,
		p.title AS parent_title,
		p.details AS parent_details,
		p.date AS parent_date,
		p.rating AS parent_rating,
		p.organized AS parent_organized,
		p.is_nsfw AS parent_is_nsfw,
		p.urls AS parent_urls,
		p.studio_id AS parent_studio_id,
		p.folder_path AS parent_folder_path,
		CASE
			WHEN p.id IS NOT NULL
				AND coalesce(p.image_count, 0) = 0
				AND NOT EXISTS (
					SELECT 1
					FROM galleries sibling
					WHERE sibling.parent_id = p.id
						AND NOT (
							sibling.gallery_type = 'zip'
							AND (
								lower(coalesce(sibling.zip_file_path, '')) LIKE '%.zip'
								OR lower(coalesce(sibling.zip_file_path, '')) LIKE '%.cbz'
							)
						)
				)
			THEN p.id
			ELSE g.id
		END AS legacy_book_gallery_id
	FROM galleries g
	INNER JOIN library_roots lr
		ON g.zip_file_path = lr.path OR g.zip_file_path LIKE lr.path || '/%'
	LEFT JOIN galleries p ON p.id = g.parent_id
	WHERE g.gallery_type = 'zip'
		AND (
			lower(coalesce(g.zip_file_path, '')) LIKE '%.zip'
			OR lower(coalesce(g.zip_file_path, '')) LIKE '%.cbz'
		)
	ORDER BY g.id, length(lr.path) DESC
),
book_sources AS (
	SELECT DISTINCT ON (legacy_book_gallery_id)
		legacy_book_gallery_id,
		library_root_id,
		COALESCE(parent_title, title) AS title,
		COALESCE(parent_details, details) AS details,
		COALESCE(parent_date, date) AS date,
		COALESCE(parent_rating, rating) AS rating,
		COALESCE(parent_organized, organized) AS organized,
		COALESCE(parent_is_nsfw, is_nsfw) AS is_nsfw,
		COALESCE(parent_urls, urls, '[]'::jsonb) AS urls,
		COALESCE(parent_studio_id, studio_id) AS studio_id,
		COALESCE(parent_folder_path, regexp_replace(zip_file_path, '/[^/]*$', '')) AS folder_path,
		COALESCE(parent_folder_path, zip_file_path) AS relative_path,
		created_at,
		updated_at
	FROM archive_galleries
	ORDER BY legacy_book_gallery_id, created_at
),
inserted_books AS (
	INSERT INTO books (
		library_root_id,
		book_type,
		title,
		details,
		date,
		rating,
		organized,
		is_nsfw,
		urls,
		folder_path,
		relative_path,
		studio_id,
		created_at,
		updated_at
	)
	SELECT
		library_root_id,
		'comic',
		title,
		details,
		date,
		rating,
		organized,
		is_nsfw,
		urls,
		folder_path,
		relative_path,
		studio_id,
		created_at,
		updated_at
	FROM book_sources
	ON CONFLICT (library_root_id, relative_path) DO UPDATE SET
		title = EXCLUDED.title,
		details = EXCLUDED.details,
		date = EXCLUDED.date,
		rating = EXCLUDED.rating,
		organized = EXCLUDED.organized,
		is_nsfw = EXCLUDED.is_nsfw,
		urls = EXCLUDED.urls,
		folder_path = EXCLUDED.folder_path,
		studio_id = EXCLUDED.studio_id,
		updated_at = EXCLUDED.updated_at
	RETURNING id, library_root_id, relative_path
)
INSERT INTO book_legacy_gallery_map (gallery_id, book_id)
SELECT bs.legacy_book_gallery_id, ib.id
FROM book_sources bs
INNER JOIN inserted_books ib
	ON ib.library_root_id = bs.library_root_id
	AND ib.relative_path = bs.relative_path
ON CONFLICT (gallery_id) DO NOTHING;--> statement-breakpoint
WITH archive_galleries AS (
	SELECT DISTINCT ON (g.id)
		g.*,
		lr.id AS library_root_id,
		p.id AS parent_gallery_id,
		p.folder_path AS parent_folder_path,
		CASE
			WHEN p.id IS NOT NULL
				AND coalesce(p.image_count, 0) = 0
				AND NOT EXISTS (
					SELECT 1
					FROM galleries sibling
					WHERE sibling.parent_id = p.id
						AND NOT (
							sibling.gallery_type = 'zip'
							AND (
								lower(coalesce(sibling.zip_file_path, '')) LIKE '%.zip'
								OR lower(coalesce(sibling.zip_file_path, '')) LIKE '%.cbz'
							)
						)
				)
			THEN p.id
			ELSE g.id
		END AS legacy_book_gallery_id
	FROM galleries g
	INNER JOIN library_roots lr
		ON g.zip_file_path = lr.path OR g.zip_file_path LIKE lr.path || '/%'
	LEFT JOIN galleries p ON p.id = g.parent_id
	WHERE g.gallery_type = 'zip'
		AND (
			lower(coalesce(g.zip_file_path, '')) LIKE '%.zip'
			OR lower(coalesce(g.zip_file_path, '')) LIKE '%.cbz'
		)
	ORDER BY g.id, length(lr.path) DESC
),
chapter_sources AS (
	SELECT
		ag.*,
		blgm.book_id,
		ROW_NUMBER() OVER (PARTITION BY blgm.book_id ORDER BY ag.title, ag.zip_file_path) AS chapter_number
	FROM archive_galleries ag
	INNER JOIN book_legacy_gallery_map blgm ON blgm.gallery_id = ag.legacy_book_gallery_id
)
INSERT INTO book_chapters (
	book_id,
	title,
	chapter_number,
	archive_path,
	relative_path,
	page_count,
	cover_page_id,
	created_at,
	updated_at
)
SELECT
	book_id,
	title,
	chapter_number,
	zip_file_path,
	zip_file_path,
	image_count,
	NULL,
	created_at,
	updated_at
FROM chapter_sources
ON CONFLICT (archive_path) DO UPDATE SET
	book_id = EXCLUDED.book_id,
	title = EXCLUDED.title,
	chapter_number = EXCLUDED.chapter_number,
	relative_path = EXCLUDED.relative_path,
	page_count = EXCLUDED.page_count,
	cover_page_id = EXCLUDED.cover_page_id,
	updated_at = EXCLUDED.updated_at;--> statement-breakpoint
WITH archive_galleries AS (
	SELECT DISTINCT ON (g.id)
		g.id,
		CASE
			WHEN p.id IS NOT NULL
				AND coalesce(p.image_count, 0) = 0
				AND NOT EXISTS (
					SELECT 1
					FROM galleries sibling
					WHERE sibling.parent_id = p.id
						AND NOT (
							sibling.gallery_type = 'zip'
							AND (
								lower(coalesce(sibling.zip_file_path, '')) LIKE '%.zip'
								OR lower(coalesce(sibling.zip_file_path, '')) LIKE '%.cbz'
							)
						)
				)
			THEN p.id
			ELSE g.id
		END AS legacy_book_gallery_id,
		g.zip_file_path
	FROM galleries g
	INNER JOIN library_roots lr
		ON g.zip_file_path = lr.path OR g.zip_file_path LIKE lr.path || '/%'
	LEFT JOIN galleries p ON p.id = g.parent_id
	WHERE g.gallery_type = 'zip'
		AND (
			lower(coalesce(g.zip_file_path, '')) LIKE '%.zip'
			OR lower(coalesce(g.zip_file_path, '')) LIKE '%.cbz'
		)
	ORDER BY g.id, length(lr.path) DESC
),
chapter_map AS (
	SELECT ag.id AS gallery_id, bc.id AS chapter_id, bc.book_id
	FROM archive_galleries ag
	INNER JOIN book_legacy_gallery_map blgm ON blgm.gallery_id = ag.legacy_book_gallery_id
	INNER JOIN book_chapters bc ON bc.book_id = blgm.book_id AND bc.archive_path = ag.zip_file_path
)
INSERT INTO book_pages (
	book_id,
	chapter_id,
	title,
	file_path,
	file_size,
	width,
	height,
	format,
	thumbnail_path,
	sort_order,
	is_nsfw,
	created_at,
	updated_at
)
SELECT
	cm.book_id,
	cm.chapter_id,
	i.title,
	i.file_path,
	i.file_size,
	i.width,
	i.height,
	i.format,
	i.thumbnail_path,
	i.sort_order,
	i.is_nsfw,
	i.created_at,
	i.updated_at
FROM images i
INNER JOIN chapter_map cm ON cm.gallery_id = i.gallery_id
ON CONFLICT (file_path) DO UPDATE SET
	book_id = EXCLUDED.book_id,
	chapter_id = EXCLUDED.chapter_id,
	title = EXCLUDED.title,
	file_size = EXCLUDED.file_size,
	width = EXCLUDED.width,
	height = EXCLUDED.height,
	format = EXCLUDED.format,
	thumbnail_path = EXCLUDED.thumbnail_path,
	sort_order = EXCLUDED.sort_order,
	is_nsfw = EXCLUDED.is_nsfw,
	updated_at = EXCLUDED.updated_at;--> statement-breakpoint
UPDATE book_chapters bc
SET
	page_count = page_counts.page_count,
	cover_page_id = COALESCE(bc.cover_page_id, page_counts.cover_page_id),
	updated_at = now()
FROM (
	SELECT
		chapter_id,
		count(*)::int AS page_count,
		(ARRAY_AGG(id ORDER BY sort_order))[1] AS cover_page_id
	FROM book_pages
	GROUP BY chapter_id
) page_counts
WHERE page_counts.chapter_id = bc.id;--> statement-breakpoint
UPDATE books b
SET
	page_count = book_counts.page_count,
	chapter_count = book_counts.chapter_count,
	cover_page_id = COALESCE(b.cover_page_id, book_counts.cover_page_id),
	cover_image_path = '/assets/book-pages/' || COALESCE(b.cover_page_id, book_counts.cover_page_id)::text || '/thumb',
	updated_at = now()
FROM (
	SELECT
		book_id,
		count(*)::int AS page_count,
		count(DISTINCT chapter_id)::int AS chapter_count,
		(ARRAY_AGG(id ORDER BY chapter_id, sort_order))[1] AS cover_page_id
	FROM book_pages
	GROUP BY book_id
) book_counts
WHERE book_counts.book_id = b.id;--> statement-breakpoint
INSERT INTO book_performers (book_id, performer_id)
SELECT DISTINCT blgm.book_id, gp.performer_id
FROM book_legacy_gallery_map blgm
INNER JOIN gallery_performers gp ON gp.gallery_id = blgm.gallery_id
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO book_tags (book_id, tag_id)
SELECT DISTINCT blgm.book_id, gt.tag_id
FROM book_legacy_gallery_map blgm
INNER JOIN gallery_tags gt ON gt.gallery_id = blgm.gallery_id
ON CONFLICT DO NOTHING;--> statement-breakpoint
WITH archive_map AS (
	SELECT
		ag.id AS gallery_id,
		blgm.book_id,
		bc.id AS chapter_id
	FROM galleries ag
	INNER JOIN book_legacy_gallery_map blgm ON blgm.gallery_id = ag.id
	LEFT JOIN book_chapters bc ON bc.book_id = blgm.book_id AND bc.archive_path = ag.zip_file_path
	WHERE ag.gallery_type = 'zip'
),
progress_rows AS (
	SELECT
		am.book_id,
		am.chapter_id,
		GREATEST(0, COALESCE((prefs.value->>'pageIndex')::int, 0)) AS page_index,
		GREATEST(0, COALESCE((prefs.value->>'pageCount')::int, 0)) AS page_count,
		CASE WHEN prefs.value->>'readerMode' = 'webtoon' THEN 'webtoon' ELSE 'paged' END AS reader_mode,
		NULLIF(prefs.value->>'completedAt', '')::timestamp AS completed_at
	FROM ui_prefs prefs
	INNER JOIN archive_map am
		ON prefs.key = 'comic-reader:' || am.gallery_id::text || ':progress'
)
INSERT INTO book_read_progress (
	book_id,
	chapter_id,
	page_index,
	page_count,
	reader_mode,
	completed_at,
	updated_at
)
SELECT DISTINCT ON (book_id)
	book_id,
	chapter_id,
	page_index,
	page_count,
	reader_mode,
	completed_at,
	now()
FROM progress_rows
ORDER BY book_id, completed_at DESC NULLS LAST
ON CONFLICT (book_id) DO UPDATE SET
	chapter_id = EXCLUDED.chapter_id,
	page_index = EXCLUDED.page_index,
	page_count = EXCLUDED.page_count,
	reader_mode = EXCLUDED.reader_mode,
	completed_at = EXCLUDED.completed_at,
	updated_at = EXCLUDED.updated_at;--> statement-breakpoint
INSERT INTO book_legacy_gallery_map (gallery_id, book_id, chapter_id)
SELECT ag.id, blgm.book_id, bc.id
FROM galleries ag
INNER JOIN book_legacy_gallery_map blgm
	ON blgm.gallery_id = COALESCE(ag.parent_id, ag.id)
INNER JOIN book_chapters bc
	ON bc.book_id = blgm.book_id
	AND bc.archive_path = ag.zip_file_path
WHERE ag.gallery_type = 'zip'
	AND (
		lower(coalesce(ag.zip_file_path, '')) LIKE '%.zip'
		OR lower(coalesce(ag.zip_file_path, '')) LIKE '%.cbz'
	)
ON CONFLICT (gallery_id) DO UPDATE SET
	book_id = EXCLUDED.book_id,
	chapter_id = EXCLUDED.chapter_id;--> statement-breakpoint
INSERT INTO book_performers (book_id, performer_id)
SELECT DISTINCT blgm.book_id, gp.performer_id
FROM book_legacy_gallery_map blgm
INNER JOIN gallery_performers gp ON gp.gallery_id = blgm.gallery_id
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO book_tags (book_id, tag_id)
SELECT DISTINCT blgm.book_id, gt.tag_id
FROM book_legacy_gallery_map blgm
INNER JOIN gallery_tags gt ON gt.gallery_id = blgm.gallery_id
ON CONFLICT DO NOTHING;--> statement-breakpoint
WITH archive_map AS (
	SELECT
		ag.id AS gallery_id,
		blgm.book_id,
		blgm.chapter_id
	FROM galleries ag
	INNER JOIN book_legacy_gallery_map blgm ON blgm.gallery_id = ag.id
	WHERE ag.gallery_type = 'zip'
),
progress_rows AS (
	SELECT
		am.book_id,
		am.chapter_id,
		GREATEST(0, COALESCE((prefs.value->>'pageIndex')::int, 0)) AS page_index,
		GREATEST(0, COALESCE((prefs.value->>'pageCount')::int, 0)) AS page_count,
		CASE WHEN prefs.value->>'readerMode' = 'webtoon' THEN 'webtoon' ELSE 'paged' END AS reader_mode,
		NULLIF(prefs.value->>'completedAt', '')::timestamp AS completed_at
	FROM ui_prefs prefs
	INNER JOIN archive_map am
		ON prefs.key = 'comic-reader:' || am.gallery_id::text || ':progress'
)
INSERT INTO book_read_progress (
	book_id,
	chapter_id,
	page_index,
	page_count,
	reader_mode,
	completed_at,
	updated_at
)
SELECT DISTINCT ON (book_id)
	book_id,
	chapter_id,
	page_index,
	page_count,
	reader_mode,
	completed_at,
	now()
FROM progress_rows
ORDER BY book_id, completed_at DESC NULLS LAST
ON CONFLICT (book_id) DO UPDATE SET
	chapter_id = EXCLUDED.chapter_id,
	page_index = EXCLUDED.page_index,
	page_count = EXCLUDED.page_count,
	reader_mode = EXCLUDED.reader_mode,
	completed_at = EXCLUDED.completed_at,
	updated_at = EXCLUDED.updated_at;--> statement-breakpoint
UPDATE book_legacy_gallery_map blgm
SET chapter_id = bc.id
FROM galleries ag
INNER JOIN book_chapters bc ON bc.archive_path = ag.zip_file_path
WHERE blgm.gallery_id = ag.id
	AND bc.book_id = blgm.book_id
	AND blgm.chapter_id IS NULL;--> statement-breakpoint
DELETE FROM images
WHERE gallery_id IN (SELECT gallery_id FROM book_legacy_gallery_map);--> statement-breakpoint
UPDATE galleries
SET parent_id = NULL, updated_at = now()
WHERE parent_id IN (SELECT gallery_id FROM book_legacy_gallery_map);--> statement-breakpoint
DELETE FROM galleries
WHERE id IN (SELECT gallery_id FROM book_legacy_gallery_map);
