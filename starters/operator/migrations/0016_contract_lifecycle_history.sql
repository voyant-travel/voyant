ALTER TABLE "contracts" ADD COLUMN "stage_history" jsonb DEFAULT '[]'::jsonb NOT NULL;
