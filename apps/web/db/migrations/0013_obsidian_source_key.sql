ALTER TABLE "bookmark" ADD COLUMN "source_key" text;
CREATE UNIQUE INDEX "bookmark_user_sourceKey_idx" ON "bookmark" ("user_id", "source_key");
