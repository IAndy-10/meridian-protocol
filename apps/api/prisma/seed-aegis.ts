/**
 * AegisBrain seed: synthetic source artifacts, protocol versions,
 * screening/assessment fixtures, and coverage manifest.
 *
 * Uses exact IDs and values from specs/FIXTURES.md.
 * Idempotent — upserts on natural keys. HydraDB ingestion is attempted
 * but non-fatal (HYDRA_DB_API_KEY may be absent in dev).
 *
 *   pnpm --filter @app-starter/api ts-node prisma/seed-aegis.ts
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
import * as path from 'path';

const apiRoot = path.resolve(__dirname, '..');
if (process.env.NODE_ENV === 'test') {
  dotenv.config({ path: path.join(apiRoot, '.env.test.local') });
  dotenv.config({ path: path.join(apiRoot, '.env.test') });
} else {
  dotenv.config({ path: path.join(apiRoot, '.env') });
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set.');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function hash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

// Deterministic IDs from FIXTURES.md
const ORG_ID = 'org-aegis-001';

const PUBLICATIONS = [
  { id: 'sa-p1', title: 'Coleman et al. 2021 — Identifying People at Risk for Suicide', excerpt: 'Nearly 10 million members; indicated C-SSRS administration within two business days after PHQ-9/PHQA item 9 >=1.' },
  { id: 'sa-p2', title: 'Yarborough et al. 2019 — Challenges of Population-based Measurement', excerpt: 'C-SSRS responses could be discrete fields or narrative summaries. Variation can undercount assessment efforts.' },
  { id: 'sa-p3', title: 'Richards et al. 2021 — Implementation Evaluation of Zero Suicide', excerpt: 'Identification was relatively well-defined and measurable; engagement and transition practices were less consistently measured.' },
  { id: 'sa-p4', title: 'Boggs et al. 2024 — Suicide Screening, Risk Assessment', excerpt: 'Assessment after a positive screen in 76.8% of specialty mental-health cases and 43.2% of primary-care cases.' },
  { id: 'sa-p5', title: 'Ahmedani et al. 2025 — Zero Suicide Model and Suicide Attempt Rates', excerpt: 'Associations between bundled Zero Suicide implementation and changes in outpatient mental-health suicide-attempt rates.' },
  { id: 'sa-p6', title: 'NIMH ASQ Toolkit Materials', excerpt: 'NIMH ASQ guidance describes a trained-clinician BSSA after a positive ASQ screen in medical settings.' },
];

const SYNTH_PROCS = [
  {
    id: 'sa-synth-proc-1',
    title: 'Cascadia BH Screening-to-Assessment Protocol v1.0',
    storedText: `SYNTHETIC — NOT AN APPROVED CLINICAL PROCEDURE

This is a synthetic organizational procedure created for demonstration purposes only.
Scope: Adults >=18, specialty mental health only.
Screening instrument: PHQ-9, item 9 >=1 triggers eligibility flag.
Assessment instrument: C-SSRS, documented completion required.
Reporting interval: Two business days from screen occurrence, inclusive of endpoint.
Calendar: Weekends (Sat/Sun) and US federal holidays excluded. Version: cal-v1.
Timezone: America/Los_Angeles.`,
  },
  {
    id: 'sa-synth-proc-2',
    title: 'Cascadia BH Screening-to-Assessment Protocol v2.0',
    storedText: `SYNTHETIC — NOT AN APPROVED CLINICAL PROCEDURE

Protocol v2.0 — identical rules to v1.0, effective from 2026-10-01 onward.
Scope: Adults >=18, specialty mental health only.
Screening instrument: PHQ-9, item 9 >=1 triggers eligibility flag.
Assessment instrument: C-SSRS, documented completion required.
Reporting interval: Two business days from screen occurrence, inclusive of endpoint.
Calendar: Weekends (Sat/Sun) and US federal holidays excluded. Version: cal-v1.
Timezone: America/Los_Angeles.`,
  },
];

async function seedAegisBrain() {
  // 1. Ensure the demo org exists
  const org = await prisma.organization.upsert({
    where: { slug: 'cascadia-bh' },
    update: {},
    create: {
      id: ORG_ID,
      name: 'Cascadia Behavioral Health (fictional)',
      slug: 'cascadia-bh',
      description: 'SYNTHETIC organization for AegisBrain reconciliation demonstrator.',
      timezone: 'America/Los_Angeles',
    },
  });
  const orgId = org.id;

  // 2. Source artifacts — publications
  for (const pub of PUBLICATIONS) {
    await prisma.sourceArtifact.upsert({
      where: { id: pub.id },
      update: {},
      create: {
        id: pub.id,
        organizationId: orgId,
        kind: 'PUBLICATION',
        title: pub.title,
        excerpt: pub.excerpt,
        contentHash: hash(pub.excerpt),
      },
    });
  }

  // Synthetic procedures
  for (const proc of SYNTH_PROCS) {
    await prisma.sourceArtifact.upsert({
      where: { id: proc.id },
      update: {},
      create: {
        id: proc.id,
        organizationId: orgId,
        kind: 'SYNTHETIC_PROCEDURE',
        title: proc.title,
        storedText: proc.storedText,
        contentHash: hash(proc.storedText),
      },
    });
  }

  // 3. HydraDB ingestion (best-effort)
  if (process.env.HYDRA_DB_API_KEY) {
    console.log('HydraDB API key found — attempting ingestion...');
    try {
      const dbName = `org_${orgId.replace(/-/g, '_')}`;
      const baseUrl = 'https://api.hydradb.com';
      const headers = {
        'Authorization': `Bearer ${process.env.HYDRA_DB_API_KEY}`,
        'API-Version': '2',
        'Content-Type': 'application/json',
      };

      try {
        await fetch(`${baseUrl}/databases`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ database: dbName }),
        });
      } catch {
        // ignore — may already exist
      }

      const allDocs = [
        ...PUBLICATIONS.map((p) => ({ id: p.id, title: p.title, content: p.excerpt })),
        ...SYNTH_PROCS.map((p) => ({ id: p.id, title: p.title, content: p.storedText })),
      ];

      for (const doc of allDocs) {
        try {
          const formData = new FormData();
          formData.append('database', dbName);
          formData.append('collection', 'source_artifacts');
          formData.append('type', 'knowledge');
          formData.append('upsert', 'true');
          const blob = new Blob([doc.content], { type: 'text/plain' });
          formData.append('documents', blob, `${doc.id}.md`);
          formData.append('document_metadata', JSON.stringify([{ id: doc.id, title: doc.title }]));

          const res = await fetch(`${baseUrl}/context/ingest`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.HYDRA_DB_API_KEY}`,
              'API-Version': '2',
            },
            body: formData,
          });
          if (res.ok) {
            const data = await res.json() as { data: { source_ids: string[] } };
            const hydraId = data.data.source_ids[0];
            if (hydraId) {
              await prisma.sourceArtifact.update({
                where: { id: doc.id },
                data: { hydraSourceId: hydraId },
              });
              console.log(`  Ingested ${doc.id} -> ${hydraId}`);
            }
          }
        } catch (err) {
          console.warn(`  Failed to ingest ${doc.id}: ${err}`);
        }
      }
    } catch (err) {
      console.warn(`HydraDB ingestion failed (non-fatal): ${err}`);
    }
  } else {
    console.log('HYDRA_DB_API_KEY not set — skipping HydraDB ingestion.');
  }

  // 4. Protocol versions + measure definitions
  await prisma.protocolVersion.upsert({
    where: { id: 'pv-1' },
    update: {},
    create: {
      id: 'pv-1',
      organizationId: orgId,
      version: '1.0',
      approvalStatus: 'APPROVED_SYNTHETIC',
      isSynthetic: true,
      approverLabel: 'Synthetic QI Committee',
      effectiveFrom: new Date('2026-06-01T00:00:00-07:00'),
      effectiveTo: new Date('2026-10-01T00:00:00-07:00'),
      sourceArtifactId: 'sa-synth-proc-1',
      timezone: 'America/Los_Angeles',
      calendarVersion: 'cal-v1',
      responsibleClinicalRole: 'Attending Psychiatrist',
      operationalReviewRole: 'QI Analyst',
    },
  });

  await prisma.measureDefinition.upsert({
    where: { id: 'md-1' },
    update: {},
    create: {
      id: 'md-1',
      version: '1.0',
      protocolVersionId: 'pv-1',
      populationMinAge: 18,
      settingFilter: 'specialty_mental_health',
      eligibilityRule: 'PHQ-9 item 9 >= 1 AND assessmentRequired = true',
      qualifyingAssessment: 'C-SSRS with documentedCompletionFlag = true',
      linkageRules: 'Prefer explicit triggeringScreenId; fallback to same-encounter if exactly 1 candidate and 1 eligible screen; no closest-timestamp selection; no assessment reuse',
      reportingIntervalDays: 2,
      timeAnchor: 'screen_occurrence',
      boundaryInclusivity: 'inclusive',
      duplicatePolicy: 'Exact duplicate source records idempotent; conflicting records with same sourceRecordId quarantined as INVALID',
      exclusionPolicy: 'Age < 18 excluded; setting != specialty_mental_health excluded; explicit assessmentRequired = false excluded',
    },
  });

  await prisma.protocolVersion.upsert({
    where: { id: 'pv-2' },
    update: {},
    create: {
      id: 'pv-2',
      organizationId: orgId,
      version: '2.0',
      approvalStatus: 'APPROVED_SYNTHETIC',
      isSynthetic: true,
      approverLabel: 'Synthetic QI Committee',
      effectiveFrom: new Date('2026-10-01T00:00:00-07:00'),
      effectiveTo: null,
      sourceArtifactId: 'sa-synth-proc-2',
      timezone: 'America/Los_Angeles',
      calendarVersion: 'cal-v1',
      responsibleClinicalRole: 'Attending Psychiatrist',
      operationalReviewRole: 'QI Analyst',
    },
  });

  await prisma.measureDefinition.upsert({
    where: { id: 'md-2' },
    update: {},
    create: {
      id: 'md-2',
      version: '2.0',
      protocolVersionId: 'pv-2',
      populationMinAge: 18,
      settingFilter: 'specialty_mental_health',
      eligibilityRule: 'PHQ-9 item 9 >= 1 AND assessmentRequired = true',
      qualifyingAssessment: 'C-SSRS with documentedCompletionFlag = true',
      linkageRules: 'Prefer explicit triggeringScreenId; fallback to same-encounter if exactly 1 candidate and 1 eligible screen; no closest-timestamp selection; no assessment reuse',
      reportingIntervalDays: 2,
      timeAnchor: 'screen_occurrence',
      boundaryInclusivity: 'inclusive',
      duplicatePolicy: 'Exact duplicate source records idempotent; conflicting records with same sourceRecordId quarantined as INVALID',
      exclusionPolicy: 'Age < 18 excluded; setting != specialty_mental_health excluded; explicit assessmentRequired = false excluded',
    },
  });

  // 5. Screening events — exact IDs from FIXTURES.md
  const screens = [
    { id: 'scr-E01', syntheticPatientId: 'SP-001', encounterId: 'enc-001', occurredAt: '2026-08-03T09:30:00-07:00', recordedAt: '2026-08-03T09:35:00-07:00', ageAtEvent: 34, setting: 'specialty_mental_health', item9Value: 2, assessmentRequired: true, eligibilityRuleVersion: 'md-1', sourceRecordId: 'SRC-SCR-001' },
    { id: 'scr-E02', syntheticPatientId: 'SP-002', encounterId: 'enc-002', occurredAt: '2026-08-10T14:00:00-07:00', recordedAt: '2026-08-10T14:05:00-07:00', ageAtEvent: 45, setting: 'specialty_mental_health', item9Value: 1, assessmentRequired: true, eligibilityRuleVersion: 'md-1', sourceRecordId: 'SRC-SCR-002' },
    { id: 'scr-E03', syntheticPatientId: 'SP-003', encounterId: 'enc-003', occurredAt: '2026-08-14T10:00:00-07:00', recordedAt: '2026-08-14T10:10:00-07:00', ageAtEvent: 28, setting: 'specialty_mental_health', item9Value: 3, assessmentRequired: true, eligibilityRuleVersion: 'md-1', sourceRecordId: 'SRC-SCR-003' },
    { id: 'scr-E04', syntheticPatientId: 'SP-004', encounterId: 'enc-004', occurredAt: '2026-09-04T11:00:00-07:00', recordedAt: '2026-09-04T11:05:00-07:00', ageAtEvent: 52, setting: 'specialty_mental_health', item9Value: 1, assessmentRequired: true, eligibilityRuleVersion: 'md-1', sourceRecordId: 'SRC-SCR-004' },
    { id: 'scr-E05', syntheticPatientId: 'SP-005', encounterId: 'enc-005', occurredAt: '2026-08-17T09:00:00-07:00', recordedAt: '2026-08-17T09:05:00-07:00', ageAtEvent: 39, setting: 'specialty_mental_health', item9Value: 2, assessmentRequired: true, eligibilityRuleVersion: 'md-1', sourceRecordId: 'SRC-SCR-005' },
    { id: 'scr-E06', syntheticPatientId: 'SP-006', encounterId: 'enc-006', occurredAt: '2026-08-20T10:00:00-07:00', recordedAt: '2026-08-20T10:05:00-07:00', ageAtEvent: 41, setting: 'specialty_mental_health', item9Value: 1, assessmentRequired: true, eligibilityRuleVersion: 'md-1', sourceRecordId: 'SRC-SCR-006' },
    { id: 'scr-E07', syntheticPatientId: 'SP-007', encounterId: 'enc-007', occurredAt: '2026-08-24T09:00:00-07:00', recordedAt: '2026-08-24T09:05:00-07:00', ageAtEvent: 55, setting: 'specialty_mental_health', item9Value: 2, assessmentRequired: true, eligibilityRuleVersion: 'md-1', sourceRecordId: 'SRC-SCR-007' },
    { id: 'scr-E08', syntheticPatientId: 'SP-008', encounterId: 'enc-008', occurredAt: '2026-08-26T10:00:00-07:00', recordedAt: '2026-08-26T10:05:00-07:00', ageAtEvent: 33, setting: 'specialty_mental_health', item9Value: 1, assessmentRequired: true, eligibilityRuleVersion: 'md-1', sourceRecordId: 'SRC-SCR-008' },
    { id: 'scr-E09', syntheticPatientId: 'SP-009', encounterId: 'enc-009', occurredAt: '2026-08-31T09:00:00-07:00', recordedAt: '2026-08-31T09:05:00-07:00', ageAtEvent: 47, setting: 'specialty_mental_health', item9Value: 2, assessmentRequired: true, eligibilityRuleVersion: 'md-1', sourceRecordId: 'SRC-SCR-009' },
    { id: 'scr-E09b', syntheticPatientId: 'SP-009', encounterId: 'enc-009b', occurredAt: '2026-09-01T09:00:00-07:00', recordedAt: '2026-09-01T09:05:00-07:00', ageAtEvent: 47, setting: 'specialty_mental_health', item9Value: 1, assessmentRequired: true, eligibilityRuleVersion: 'md-1', sourceRecordId: 'SRC-SCR-009B' },
    { id: 'scr-E10', syntheticPatientId: 'SP-010', encounterId: 'enc-010', occurredAt: '2026-10-11T14:00:00-07:00', recordedAt: '2026-10-12T07:30:00-07:00', ageAtEvent: 29, setting: 'specialty_mental_health', item9Value: 1, assessmentRequired: true, eligibilityRuleVersion: 'md-2', sourceRecordId: 'SRC-SCR-010' },
    { id: 'scr-E11', syntheticPatientId: 'SP-011', encounterId: 'enc-011', occurredAt: '2026-08-19T10:00:00-07:00', recordedAt: '2026-08-19T10:05:00-07:00', ageAtEvent: 36, setting: 'specialty_mental_health', item9Value: 1, assessmentRequired: true, eligibilityRuleVersion: 'md-1', sourceRecordId: 'SRC-SCR-011' },
    { id: 'scr-E12', syntheticPatientId: 'SP-012', encounterId: 'enc-012', occurredAt: '2026-09-15T09:00:00-07:00', recordedAt: '2026-09-15T09:05:00-07:00', ageAtEvent: 43, setting: 'specialty_mental_health', item9Value: 2, assessmentRequired: true, eligibilityRuleVersion: 'md-1', sourceRecordId: 'SRC-SCR-012', sourceLocation: 'satellite-clinic-ehr' },
    { id: 'scr-X01', syntheticPatientId: 'SP-013', encounterId: 'enc-013', occurredAt: '2026-08-05T10:00:00-07:00', recordedAt: '2026-08-05T10:05:00-07:00', ageAtEvent: 38, setting: 'specialty_mental_health', item9Value: 0, assessmentRequired: false, eligibilityRuleVersion: 'md-1', sourceRecordId: 'SRC-SCR-013' },
    { id: 'scr-X02', syntheticPatientId: 'SP-014', encounterId: 'enc-014', occurredAt: '2026-08-07T11:00:00-07:00', recordedAt: '2026-08-07T11:05:00-07:00', ageAtEvent: 16, setting: 'specialty_mental_health', item9Value: 2, assessmentRequired: true, eligibilityRuleVersion: 'md-1', sourceRecordId: 'SRC-SCR-014' },
    { id: 'scr-X03', syntheticPatientId: 'SP-015', encounterId: 'enc-015', occurredAt: '2026-08-11T09:30:00-07:00', recordedAt: '2026-08-11T09:35:00-07:00', ageAtEvent: 42, setting: 'primary_care', item9Value: 1, assessmentRequired: true, eligibilityRuleVersion: 'md-1', sourceRecordId: 'SRC-SCR-015' },
    { id: 'scr-U01', syntheticPatientId: 'SP-016', encounterId: 'enc-016', occurredAt: '2026-08-12T14:00:00-07:00', recordedAt: '2026-08-12T14:05:00-07:00', ageAtEvent: 31, setting: 'specialty_mental_health', item9Value: 1, assessmentRequired: null, eligibilityRuleVersion: 'md-1', sourceRecordId: 'SRC-SCR-016' },
  ];

  for (const s of screens) {
    await prisma.screeningEvent.upsert({
      where: { sourceRecordId_sourceSystem: { sourceRecordId: s.sourceRecordId, sourceSystem: 'synthetic-ehr' } },
      update: {},
      create: {
        id: s.id,
        organizationId: orgId,
        syntheticPatientId: s.syntheticPatientId,
        encounterId: s.encounterId,
        occurredAt: new Date(s.occurredAt),
        recordedAt: new Date(s.recordedAt),
        ageAtEvent: s.ageAtEvent,
        setting: s.setting,
        instrumentName: 'PHQ-9',
        instrumentVersion: '9.0',
        item9Value: s.item9Value,
        assessmentRequired: s.assessmentRequired,
        eligibilityRuleVersion: s.eligibilityRuleVersion,
        sourceRecordId: s.sourceRecordId,
        sourceSystem: 'synthetic-ehr',
        sourceLocation: (s as Record<string, unknown>).sourceLocation as string | undefined,
        provenanceHash: hash(s.sourceRecordId),
      },
    });
  }

  // 6. Assessment events — exact IDs from FIXTURES.md
  const assessments = [
    { id: 'asx-E01', syntheticPatientId: 'SP-001', encounterId: 'enc-001a', triggeringScreenId: 'scr-E01', performedAt: '2026-08-04T14:00:00-07:00', recordedAt: '2026-08-04T14:30:00-07:00', documentationStatus: 'COMPLETED', documentedCompletionFlag: true, sourceRecordId: 'SRC-ASX-001' },
    { id: 'asx-E02', syntheticPatientId: 'SP-002', encounterId: 'enc-002', triggeringScreenId: null, performedAt: '2026-08-10T15:00:00-07:00', recordedAt: '2026-08-10T15:10:00-07:00', documentationStatus: 'COMPLETED', documentedCompletionFlag: true, sourceRecordId: 'SRC-ASX-002' },
    { id: 'asx-E03', syntheticPatientId: 'SP-003', encounterId: 'enc-003a', triggeringScreenId: 'scr-E03', performedAt: '2026-08-18T09:00:00-07:00', recordedAt: '2026-08-18T09:30:00-07:00', documentationStatus: 'COMPLETED', documentedCompletionFlag: true, sourceRecordId: 'SRC-ASX-003' },
    { id: 'asx-E04', syntheticPatientId: 'SP-004', encounterId: 'enc-004a', triggeringScreenId: 'scr-E04', performedAt: '2026-09-09T10:00:00-07:00', recordedAt: '2026-09-09T10:15:00-07:00', documentationStatus: 'COMPLETED', documentedCompletionFlag: true, sourceRecordId: 'SRC-ASX-004' },
    { id: 'asx-E05', syntheticPatientId: 'SP-005', encounterId: 'enc-005a', triggeringScreenId: 'scr-E05', performedAt: '2026-08-21T10:00:00-07:00', recordedAt: '2026-08-21T10:30:00-07:00', documentationStatus: 'COMPLETED', documentedCompletionFlag: true, sourceRecordId: 'SRC-ASX-005' },
    { id: 'asx-E08a', syntheticPatientId: 'SP-008', encounterId: 'enc-008a', triggeringScreenId: null, performedAt: '2026-08-27T09:00:00-07:00', recordedAt: '2026-08-27T09:30:00-07:00', documentationStatus: 'COMPLETED', documentedCompletionFlag: true, sourceRecordId: 'SRC-ASX-008A' },
    { id: 'asx-E08b', syntheticPatientId: 'SP-008', encounterId: 'enc-008b', triggeringScreenId: null, performedAt: '2026-08-27T14:00:00-07:00', recordedAt: '2026-08-27T14:30:00-07:00', documentationStatus: 'COMPLETED', documentedCompletionFlag: true, sourceRecordId: 'SRC-ASX-008B' },
    { id: 'asx-E09', syntheticPatientId: 'SP-009', encounterId: 'enc-009c', triggeringScreenId: null, performedAt: '2026-09-01T11:00:00-07:00', recordedAt: '2026-09-01T11:30:00-07:00', documentationStatus: 'COMPLETED', documentedCompletionFlag: true, sourceRecordId: 'SRC-ASX-009' },
    { id: 'asx-E11', syntheticPatientId: 'SP-011', encounterId: 'enc-011a', triggeringScreenId: 'scr-E11', performedAt: '2026-08-20T10:00:00-07:00', recordedAt: '2026-08-20T10:30:00-07:00', documentationStatus: 'PARTIAL', documentedCompletionFlag: false, sourceRecordId: 'SRC-ASX-011' },
  ];

  for (const a of assessments) {
    await prisma.assessmentEvent.upsert({
      where: { sourceRecordId_sourceSystem: { sourceRecordId: a.sourceRecordId, sourceSystem: 'synthetic-ehr' } },
      update: {},
      create: {
        id: a.id,
        organizationId: orgId,
        syntheticPatientId: a.syntheticPatientId,
        encounterId: a.encounterId,
        triggeringScreenId: a.triggeringScreenId,
        performedAt: new Date(a.performedAt),
        recordedAt: new Date(a.recordedAt),
        instrumentName: 'C-SSRS',
        instrumentVersion: 'screener',
        documentationStatus: a.documentationStatus,
        documentedCompletionFlag: a.documentedCompletionFlag,
        sourceRecordId: a.sourceRecordId,
        sourceSystem: 'synthetic-ehr',
        provenanceHash: hash(a.sourceRecordId),
      },
    });
  }

  // 7. Coverage manifest — satellite-clinic-ehr is missing feed
  await prisma.coverageManifest.upsert({
    where: { id: 'cm-fixtures-1' },
    update: {},
    create: {
      id: 'cm-fixtures-1',
      runId: 'pending',
      locationsIncluded: ['main-campus-ehr', 'telehealth-platform'],
      locationsOmitted: ['satellite-clinic-ehr'],
      extractionCutoff: new Date('2026-10-12T06:00:00-07:00'),
      dataWatermark: new Date('2026-10-11T23:59:59-07:00'),
      knownMissingFeeds: ['satellite-clinic-ehr'],
      coverageStatus: 'PARTIAL',
    },
  });

  console.log('');
  console.log('AegisBrain seed complete (FIXTURES.md):');
  console.log(`  Organization: ${org.name} (${orgId})`);
  console.log(`  Source artifacts: ${PUBLICATIONS.length} publications + ${SYNTH_PROCS.length} synthetic procedures`);
  console.log(`  Protocol versions: v1.0 (Jun-Oct 2026), v2.0 (Oct 2026+)`);
  console.log(`  Screening events: ${screens.length}`);
  console.log(`  Assessment events: ${assessments.length}`);
  console.log(`  Coverage manifest: 1 (satellite-clinic-ehr omitted for E12)`);
}

async function main() {
  await seedAegisBrain();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
