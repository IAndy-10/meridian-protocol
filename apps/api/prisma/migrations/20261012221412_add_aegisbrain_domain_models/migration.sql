-- CreateTable
CREATE TABLE "source_artifacts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "stored_text" TEXT,
    "section_locator" TEXT,
    "excerpt" TEXT,
    "content_hash" TEXT NOT NULL,
    "hydra_source_id" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "protocol_versions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "approval_status" TEXT NOT NULL,
    "is_synthetic" BOOLEAN NOT NULL DEFAULT true,
    "approver_label" TEXT,
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "effective_to" TIMESTAMPTZ(6),
    "source_artifact_id" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Los_Angeles',
    "calendar_version" TEXT NOT NULL,
    "responsible_clinical_role" TEXT NOT NULL,
    "operational_review_role" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "protocol_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "measure_definitions" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "protocol_version_id" TEXT NOT NULL,
    "population_min_age" INTEGER,
    "setting_filter" TEXT NOT NULL,
    "eligibility_rule" TEXT NOT NULL,
    "qualifying_assessment" TEXT NOT NULL,
    "linkage_rules" TEXT NOT NULL,
    "reporting_interval_days" INTEGER NOT NULL,
    "time_anchor" TEXT NOT NULL,
    "boundary_inclusivity" TEXT NOT NULL,
    "duplicate_policy" TEXT NOT NULL,
    "exclusion_policy" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "measure_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screening_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "synthetic_patient_id" TEXT NOT NULL,
    "encounter_id" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL,
    "age_at_event" INTEGER NOT NULL,
    "setting" TEXT NOT NULL,
    "instrument_name" TEXT NOT NULL,
    "instrument_version" TEXT NOT NULL,
    "item_9_value" INTEGER,
    "assessment_required" BOOLEAN,
    "eligibility_rule_version" TEXT NOT NULL,
    "source_record_id" TEXT NOT NULL,
    "source_system" TEXT NOT NULL,
    "source_location" TEXT,
    "provenance_hash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "screening_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "synthetic_patient_id" TEXT NOT NULL,
    "encounter_id" TEXT NOT NULL,
    "triggering_screen_id" TEXT,
    "performed_at" TIMESTAMPTZ(6) NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL,
    "instrument_name" TEXT NOT NULL,
    "instrument_version" TEXT NOT NULL,
    "documentation_status" TEXT NOT NULL,
    "documented_completion_flag" BOOLEAN,
    "source_record_id" TEXT NOT NULL,
    "source_system" TEXT NOT NULL,
    "source_location" TEXT,
    "provenance_hash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coverage_manifests" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "locations_included" TEXT[],
    "locations_omitted" TEXT[],
    "extraction_cutoff" TIMESTAMPTZ(6) NOT NULL,
    "data_watermark" TIMESTAMPTZ(6) NOT NULL,
    "known_missing_feeds" TEXT[],
    "coverage_status" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coverage_manifests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_runs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "configuration_hash" TEXT NOT NULL,
    "engine_version" TEXT NOT NULL,
    "as_of" TIMESTAMPTZ(6) NOT NULL,
    "extraction_hash" TEXT NOT NULL,
    "decisions_json" JSONB NOT NULL,
    "summary_json" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reconciliation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_actions" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "screening_event_id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ(6) NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence_reference" TEXT,
    "status" TEXT NOT NULL,
    "previous_action_id" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "source_artifacts_organization_id_idx" ON "source_artifacts"("organization_id");

-- CreateIndex
CREATE INDEX "protocol_versions_organization_id_idx" ON "protocol_versions"("organization_id");

-- CreateIndex
CREATE INDEX "screening_events_organization_id_synthetic_patient_id_idx" ON "screening_events"("organization_id", "synthetic_patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "screening_events_source_record_id_source_system_key" ON "screening_events"("source_record_id", "source_system");

-- CreateIndex
CREATE INDEX "assessment_events_organization_id_synthetic_patient_id_idx" ON "assessment_events"("organization_id", "synthetic_patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_events_source_record_id_source_system_key" ON "assessment_events"("source_record_id", "source_system");

-- CreateIndex
CREATE INDEX "reconciliation_runs_organization_id_idx" ON "reconciliation_runs"("organization_id");

-- CreateIndex
CREATE INDEX "review_actions_run_id_screening_event_id_idx" ON "review_actions"("run_id", "screening_event_id");

-- AddForeignKey
ALTER TABLE "source_artifacts" ADD CONSTRAINT "source_artifacts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "protocol_versions" ADD CONSTRAINT "protocol_versions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "protocol_versions" ADD CONSTRAINT "protocol_versions_source_artifact_id_fkey" FOREIGN KEY ("source_artifact_id") REFERENCES "source_artifacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measure_definitions" ADD CONSTRAINT "measure_definitions_protocol_version_id_fkey" FOREIGN KEY ("protocol_version_id") REFERENCES "protocol_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screening_events" ADD CONSTRAINT "screening_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_events" ADD CONSTRAINT "assessment_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_runs" ADD CONSTRAINT "reconciliation_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
