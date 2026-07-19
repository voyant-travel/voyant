CREATE TABLE "asset_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"asset_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_asset" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"alt" text,
	"storage_key" text NOT NULL,
	"mime_type" text,
	"file_size" integer,
	"checksum" text NOT NULL,
	"width" integer,
	"height" integer,
	"duration_ms" integer,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"provider_meta" jsonb,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_folder" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"parent_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_folder_member" (
	"id" text PRIMARY KEY NOT NULL,
	"asset_id" text NOT NULL,
	"folder_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_asset_usage_asset_entity" ON "asset_usage" USING btree ("asset_id","entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_media_asset_checksum" ON "media_asset" USING btree ("checksum");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_media_folder_member_asset_folder" ON "media_folder_member" USING btree ("asset_id","folder_id");