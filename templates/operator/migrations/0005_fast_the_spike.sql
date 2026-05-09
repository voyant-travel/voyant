CREATE TABLE "product_category_translations" (
	"id" text PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"language_tag" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"seo_title" text,
	"seo_description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_tag_translations" (
	"id" text PRIMARY KEY NOT NULL,
	"tag_id" text NOT NULL,
	"language_tag" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_category_translations" ADD CONSTRAINT "product_category_translations_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_tag_translations" ADD CONSTRAINT "product_tag_translations_tag_id_product_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."product_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_product_category_translations_locale" ON "product_category_translations" USING btree ("category_id","language_tag");--> statement-breakpoint
CREATE INDEX "idx_product_category_translations_language" ON "product_category_translations" USING btree ("language_tag");--> statement-breakpoint
CREATE INDEX "idx_product_category_translations_category_language_created" ON "product_category_translations" USING btree ("category_id","language_tag","created_at");--> statement-breakpoint
CREATE INDEX "idx_product_category_translations_language_created" ON "product_category_translations" USING btree ("language_tag","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_product_tag_translations_locale" ON "product_tag_translations" USING btree ("tag_id","language_tag");--> statement-breakpoint
CREATE INDEX "idx_product_tag_translations_language" ON "product_tag_translations" USING btree ("language_tag");--> statement-breakpoint
CREATE INDEX "idx_product_tag_translations_tag_language_created" ON "product_tag_translations" USING btree ("tag_id","language_tag","created_at");--> statement-breakpoint
CREATE INDEX "idx_product_tag_translations_language_created" ON "product_tag_translations" USING btree ("language_tag","created_at");