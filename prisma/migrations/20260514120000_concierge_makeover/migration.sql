-- Concierge makeover: render pipeline, brand bible, ops, versioning

CREATE TABLE "render_job" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "outputUrl" TEXT,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "spendBreakdown" JSONB,
    "renderInput" JSONB,
    "error" TEXT,
    "directorState" JSONB,
    "render4K" BOOLEAN NOT NULL DEFAULT false,
    "stemsRequested" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "render_job_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "render_job_userId_idx" ON "render_job"("userId");
CREATE INDEX "render_job_projectId_idx" ON "render_job"("projectId");

ALTER TABLE "render_job" ADD CONSTRAINT "render_job_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "render_job" ADD CONSTRAINT "render_job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "brand_voice" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "voiceId" TEXT NOT NULL,
    "sampleUrl" TEXT,
    "vibeTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "brand_voice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "brand_bible" (
    "id" TEXT NOT NULL,
    "brandKitId" TEXT,
    "industry" TEXT,
    "motionVocabulary" TEXT,
    "typographyPairing" TEXT,
    "colorRoles" JSONB,
    "doNots" TEXT,
    "visualLanguage" TEXT NOT NULL DEFAULT 'glass_orb',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "brand_bible_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "brand_bible_brandKitId_key" ON "brand_bible"("brandKitId");

ALTER TABLE "brand_bible" ADD CONSTRAINT "brand_bible_brandKitId_fkey" FOREIGN KEY ("brandKitId") REFERENCES "brand_kit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ops_user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "totpSecret" TEXT,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ops_user_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ops_user_email_key" ON "ops_user"("email");

CREATE TABLE "client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "billingHandle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "client_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "deliverable" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "projectId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "priceCents" INTEGER NOT NULL DEFAULT 100000,
    "dueAt" TIMESTAMP(3),
    "sla" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "deliverable_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "deliverable_clientId_idx" ON "deliverable"("clientId");

ALTER TABLE "deliverable" ADD CONSTRAINT "deliverable_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deliverable" ADD CONSTRAINT "deliverable_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "revision" (
    "id" TEXT NOT NULL,
    "deliverableId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "revision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "revision_deliverableId_idx" ON "revision"("deliverableId");

ALTER TABLE "revision" ADD CONSTRAINT "revision_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "deliverable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "deliverable_event" (
    "id" TEXT NOT NULL,
    "deliverableId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "deliverable_event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "deliverable_event_deliverableId_idx" ON "deliverable_event"("deliverableId");

ALTER TABLE "deliverable_event" ADD CONSTRAINT "deliverable_event_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "deliverable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "project_version" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "videoUrl" TEXT,
    "bundleUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_version_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "project_version_projectId_idx" ON "project_version"("projectId");

ALTER TABLE "project_version" ADD CONSTRAINT "project_version_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
