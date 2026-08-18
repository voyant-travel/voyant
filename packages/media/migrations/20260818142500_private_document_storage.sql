ALTER TABLE "media_asset" ADD COLUMN "storage_class" text DEFAULT 'media' NOT NULL;--> statement-breakpoint
DROP INDEX "uidx_media_asset_checksum";--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_media_asset_storage_checksum" ON "media_asset" USING btree ("storage_class","checksum");
