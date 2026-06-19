CREATE TABLE "quote_media" (
	"id" text PRIMARY KEY NOT NULL,
	"quote_id" text NOT NULL,
	"media_type" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"storage_key" text,
	"mime_type" text,
	"file_size" integer,
	"alt_text" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quote_media" ADD CONSTRAINT "quote_media_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_quote_media_quote" ON "quote_media" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "idx_quote_media_quote_sort" ON "quote_media" USING btree ("quote_id","sort_order");