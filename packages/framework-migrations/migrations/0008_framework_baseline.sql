CREATE TABLE "product_day_service_translations" (
	"id" text PRIMARY KEY NOT NULL,
	"service_id" text NOT NULL,
	"language_tag" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_itinerary_translations" (
	"id" text PRIMARY KEY NOT NULL,
	"itinerary_id" text NOT NULL,
	"language_tag" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cloud_auth_user_links" ADD COLUMN "scopes" jsonb;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "permissions" jsonb;--> statement-breakpoint
ALTER TABLE "product_day_service_translations" ADD CONSTRAINT "product_day_service_translations_service_id_product_day_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."product_day_services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_itinerary_translations" ADD CONSTRAINT "product_itinerary_translations_itinerary_id_product_itineraries_id_fk" FOREIGN KEY ("itinerary_id") REFERENCES "public"."product_itineraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_product_day_service_translations_service" ON "product_day_service_translations" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "idx_product_day_service_translations_language" ON "product_day_service_translations" USING btree ("language_tag");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_product_day_service_translations_service_language" ON "product_day_service_translations" USING btree ("service_id","language_tag");--> statement-breakpoint
CREATE INDEX "idx_product_itinerary_translations_itinerary" ON "product_itinerary_translations" USING btree ("itinerary_id");--> statement-breakpoint
CREATE INDEX "idx_product_itinerary_translations_language" ON "product_itinerary_translations" USING btree ("language_tag");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_product_itinerary_translations_itinerary_language" ON "product_itinerary_translations" USING btree ("itinerary_id","language_tag");