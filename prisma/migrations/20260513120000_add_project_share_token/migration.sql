-- Add opaque share token for public URLs (safe to run once; uses IF NOT EXISTS patterns where possible)

ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "shareToken" TEXT;

UPDATE "project" SET "shareToken" = gen_random_uuid()::text WHERE "shareToken" IS NULL OR trim("shareToken") = '';

ALTER TABLE "project" ALTER COLUMN "shareToken" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "project_shareToken_key" ON "project"("shareToken");

ALTER TABLE "brand_kit" ADD COLUMN IF NOT EXISTS "testimonials" JSONB;
ALTER TABLE "brand_kit" ADD COLUMN IF NOT EXISTS "integrations" JSONB;
ALTER TABLE "brand_kit" ADD COLUMN IF NOT EXISTS "pricingCues" JSONB;
