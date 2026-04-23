ALTER TABLE "galleries" DROP CONSTRAINT "galleries_parent_id_galleries_id_fk";
--> statement-breakpoint
ALTER TABLE "galleries" ADD CONSTRAINT "galleries_parent_id_galleries_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."galleries"("id") ON DELETE set null ON UPDATE no action;