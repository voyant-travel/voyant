ALTER TABLE "product_media" ADD COLUMN "width" integer;
--> statement-breakpoint
ALTER TABLE "product_media" ADD COLUMN "height" integer;
--> statement-breakpoint
ALTER TABLE "product_media" ADD COLUMN "is_open_graph" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "product_media" ADD CONSTRAINT "chk_product_media_open_graph_image" CHECK ("product_media"."is_open_graph" = false OR ("product_media"."media_type" = 'image' AND "product_media"."day_id" IS NULL AND "product_media"."is_brochure" = false));
--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_product_media_open_graph" ON "product_media" USING btree ("product_id") WHERE "product_media"."is_open_graph" = true;
