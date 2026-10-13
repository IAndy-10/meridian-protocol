# SPEC-A: Schema, Configuration, and Hand-Labeled Fixtures

**Phase:** 1 (0:00-0:45)
**Agent:** schema-architect
**Produces:** Prisma models, HydraDB-ingested source artifacts, seed data, hand-labeled test fixtures

---

## Objective

Define all domain objects as Prisma models, create synthetic source artifacts,
two protocol versions, and the full known-answer fixture set from PROBLEM.md
Section 12 with expected outputs labeled before engine code exists.

## Prisma Models

### SourceArtifact

```prisma
model SourceArtifact {
  id             String @id @default(uuid())
  organizationId String @map("organization_id")
  kind           String // PUBLICATION, SYNTHETIC_PROCEDURE, LOCAL_APPROVED_POLICY
  title          String
  url            String?
  storedText     String? @map("stored_text") @db.Text
  sectionLocator String? @map("section_locator")
  excerpt        String? @db.Text
  contentHash    String @map("content_hash")
  hydraSourceId  String? @map("hydra_source_id") // FK to HydraDB document
  createdAt      DateTime @default(now()) @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId])
  @@map("source_artifacts")
}
```

### HydraDB ingestion

Each SourceArtifact is ingested into the org's HydraDB database (`org_<uuid>`)
using `HydraDbService.ingestDocument()`. The returned source ID is stored as
`hydraSourceId`. The detail panel retrieves full text and exact passages via
`HydraDbService.query()` using the `hydraSourceId`.

Seed script must:
1. Call `HydraDbService.ensureDatabase()` for the org
2. Ingest each source artifact (P1-P6 publications, synthetic procedure)
3. Store `hydraSourceId` back into the Prisma SourceArtifact record
4. Wait for indexing to complete before running reconciliation

### ProtocolVersion

```prisma
model ProtocolVersion {
  id                      String   @id @default(uuid())
  organizationId          String   @map("organization_id")
  version                 String
  approvalStatus          String   @map("approval_status")
  isSynthetic             Boolean  @default(true) @map("is_synthetic")
  approverLabel           String?  @map("approver_label")
  effectiveFrom           DateTime @map("effective_from") @db.Timestamptz(6)
  effectiveTo             DateTime? @map("effective_to") @db.Timestamptz(6)
  sourceArtifactId        String   @map("source_artifact_id")
  timezone                String   @default("America/Los_Angeles")
  calendarVersion         String   @map("calendar_version")
  responsibleClinicalRole String   @map("responsible_clinical_role")
  operationalReviewRole   String   @map("operational_review_role")
  createdAt               DateTime @default(now()) @db.Timestamptz(6)
  updatedAt               DateTime @updatedAt @db.Timestamptz(6)

  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  sourceArtifact  SourceArtifact @relation(fields: [sourceArtifactId], references: [id])

  @@index([organizationId])
  @@map("protocol_versions")
}
```

### MeasureDefinition

```prisma
model MeasureDefinition {
  id                       String @id @default(uuid())
  version                  String
  protocolVersionId        String @map("protocol_version_id")
  populationMinAge         Int?   @map("population_min_age")
  settingFilter            String @map("setting_filter") // e.g. "specialty_mental_health"
  eligibilityRule          String @map("eligibility_rule") @db.Text
  qualifyingAssessment     String @map("qualifying_assessment") @db.Text
  linkageRules             String @map("linkage_rules") @db.Text
  reportingIntervalDays    Int    @map("reporting_interval_days")
  timeAnchor               String @map("time_anchor") // "screen_occurrence"
  boundaryInclusivity      String @map("boundary_inclusivity") // "inclusive"
  duplicatePolicy          String @map("duplicate_policy") @db.Text
  exclusionPolicy          String @map("exclusion_policy") @db.Text
  createdAt                DateTime @default(now()) @db.Timestamptz(6)

  protocolVersion ProtocolVersion @relation(fields: [protocolVersionId], references: [id])

  @@map("measure_definitions")
}
```

### ScreeningEvent

```prisma
model ScreeningEvent {
  id                    String   @id @default(uuid())
  organizationId        String   @map("organization_id")
  syntheticPatientId    String   @map("synthetic_patient_id")
  encounterId           String   @map("encounter_id")
  occurredAt            DateTime @map("occurred_at") @db.Timestamptz(6)
  recordedAt            DateTime @map("recorded_at") @db.Timestamptz(6)
  ageAtEvent            Int      @map("age_at_event")
  setting               String
  instrumentName        String   @map("instrument_name")
  instrumentVersion     String   @map("instrument_version")
  item9Value            Int?     @map("item_9_value")
  assessmentRequired    Boolean? @map("assessment_required")
  eligibilityRuleVersion String  @map("eligibility_rule_version")
  sourceRecordId        String   @map("source_record_id")
  sourceSystem          String   @map("source_system")
  sourceLocation        String?  @map("source_location")
  provenanceHash        String   @map("provenance_hash")
  createdAt             DateTime @default(now()) @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([sourceRecordId, sourceSystem])
  @@index([organizationId, syntheticPatientId])
  @@map("screening_events")
}
```

### AssessmentEvent

```prisma
model AssessmentEvent {
  id                       String   @id @default(uuid())
  organizationId           String   @map("organization_id")
  syntheticPatientId       String   @map("synthetic_patient_id")
  encounterId              String   @map("encounter_id")
  triggeringScreenId       String?  @map("triggering_screen_id")
  performedAt              DateTime @map("performed_at") @db.Timestamptz(6)
  recordedAt               DateTime @map("recorded_at") @db.Timestamptz(6)
  instrumentName           String   @map("instrument_name")
  instrumentVersion        String   @map("instrument_version")
  documentationStatus      String   @map("documentation_status")
  documentedCompletionFlag Boolean? @map("documented_completion_flag")
  sourceRecordId           String   @map("source_record_id")
  sourceSystem             String   @map("source_system")
  sourceLocation           String?  @map("source_location")
  provenanceHash           String   @map("provenance_hash")
  createdAt                DateTime @default(now()) @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([sourceRecordId, sourceSystem])
  @@index([organizationId, syntheticPatientId])
  @@map("assessment_events")
}
```

### CoverageManifest, ReconciliationRun, ReviewAction

```prisma
model CoverageManifest {
  id                 String   @id @default(uuid())
  runId              String   @map("run_id")
  locationsIncluded  String[] @map("locations_included")
  locationsOmitted   String[] @map("locations_omitted")
  extractionCutoff   DateTime @map("extraction_cutoff") @db.Timestamptz(6)
  dataWatermark      DateTime @map("data_watermark") @db.Timestamptz(6)
  knownMissingFeeds  String[] @map("known_missing_feeds")
  coverageStatus     String   @map("coverage_status")
  createdAt          DateTime @default(now()) @db.Timestamptz(6)

  @@map("coverage_manifests")
}

model ReconciliationRun {
  id                String   @id @default(uuid())
  organizationId    String   @map("organization_id")
  configurationHash String   @map("configuration_hash")
  engineVersion     String   @map("engine_version")
  asOf              DateTime @map("as_of") @db.Timestamptz(6)
  extractionHash    String   @map("extraction_hash")
  decisionsJson     Json     @map("decisions_json")
  summaryJson       Json     @map("summary_json")
  createdAt         DateTime @default(now()) @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId])
  @@map("reconciliation_runs")
}

model ReviewAction {
  id                String   @id @default(uuid())
  runId             String   @map("run_id")
  screeningEventId  String   @map("screening_event_id")
  actor             String
  timestamp         DateTime @db.Timestamptz(6)
  reason            String   @db.Text
  evidenceReference String?  @map("evidence_reference") @db.Text
  status            String   // OPEN, IN_REVIEW, CLOSED_WITH_REASON, REOPENED
  previousActionId  String?  @map("previous_action_id")
  createdAt         DateTime @default(now()) @db.Timestamptz(6)

  @@index([runId, screeningEventId])
  @@map("review_actions")
}
```

## Fixture Set (Section 12)

| Case | Description | Expected eligibility | Expected linkage |
|------|-------------|---------------------|-----------------|
| E01-E04 | Eligible, mature, unique qualifying link within interval | ELIGIBLE | QUALIFYING_RECORD_LINKED_WITHIN_WINDOW |
| E05 | Eligible, mature, unique qualifying link outside interval | ELIGIBLE | QUALIFYING_RECORD_LINKED_OUTSIDE_WINDOW |
| E06-E07 | Eligible, mature, no linked record in complete feeds | ELIGIBLE | NO_LINKED_RECORD_IN_AVAILABLE_DATA |
| E08 | Eligible, mature, multiple candidate assessments | ELIGIBLE | AMBIGUOUS_LINKAGE |
| E09 | Eligible, mature, assessment contested by another screen | ELIGIBLE | AMBIGUOUS_LINKAGE |
| E10 | Eligible but reporting interval not yet mature | ELIGIBLE | NOT_YET_EVALUABLE |
| E11 | Eligible, mature, partial/nonqualifying assessment | ELIGIBLE | PARTIAL_OR_NONQUALIFYING_RECORD |
| E12 | Eligible, mature, no link and a known omitted feed | ELIGIBLE | DATA_COVERAGE_UNKNOWN |
| X01 | Explicit negative eligibility | NOT_ELIGIBLE | n/a |
| X02 | Under 18, excluded from adult-only scope | NOT_ELIGIBLE | n/a |
| X03 | Primary-care event excluded from specialty scope | NOT_ELIGIBLE | n/a |
| U01 | Missing eligibility field | INDETERMINATE | n/a |

Expected counts: 12 eligible, 11 mature eligible, 4 within-window, 1 outside-window, 2 ambiguous, 1 immature, 1 partial, 3 absent-link (1 coverage-unknown), 3 not eligible, 1 indeterminate.

## Deliverables

1. All Prisma models with migration applied
2. SourceArtifact seeds for P1-P6 publications and synthetic procedure
3. All source artifacts ingested into org's HydraDB database with `hydraSourceId` stored
4. Two ProtocolVersion + MeasureDefinition records (v1.0 and v2.0)
5. Complete fixture set with hand-labeled expected outputs
6. Expected counts documented and verified against PROBLEM.md
