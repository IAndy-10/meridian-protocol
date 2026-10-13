import { Injectable, Logger } from '@nestjs/common';
import { OrgRole, ReconciliationRun } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { reconcile } from './engine';
import type { ReconciliationInput, BusinessDayCalendar } from './engine';
import {
  ReconciliationRunSummaryDto,
  ReconciliationRunDetailDto,
  ReconciliationRunListDto,
} from './dto/reconciliation-response.dto';
import {
  ReconciliationRunNotFoundException,
  ReconciliationAccessDeniedException,
} from './exceptions/reconciliation.exceptions';

@Injectable()
export class ReconciliationService {
  private static readonly ALLOWED_ROLES: OrgRole[] = [
    OrgRole.OWNER,
    OrgRole.ADMIN,
    OrgRole.MEMBER,
  ];

  private static readonly ENGINE_VERSION = '1.0.0';

  private static readonly DEFAULT_CALENDAR: BusinessDayCalendar = {
    timezone: 'America/Los_Angeles',
    holidays: ['2026-09-07', '2026-11-26'],
    weekendDays: [0, 6],
  };

  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  async triggerRun(
    userId: string,
    organizationId: string,
    protocolVersionId?: string,
    coverageManifestId?: string,
  ): Promise<ReconciliationRunDetailDto> {
    await this.requireRole(userId, organizationId, 'trigger');

    const asOf = new Date();

    // Load screens and assessments scoped to org
    const [screens, assessments, protocolVersions, coverageManifest] = await Promise.all([
      this.prisma.screeningEvent.findMany({ where: { organizationId } }),
      this.prisma.assessmentEvent.findMany({ where: { organizationId } }),
      this.prisma.protocolVersion.findMany({
        where: protocolVersionId
          ? { id: protocolVersionId, organizationId }
          : { organizationId },
        include: { measureDefinitions: true },
      }),
      coverageManifestId
        ? this.prisma.coverageManifest.findFirst({ where: { id: coverageManifestId } })
        : this.prisma.coverageManifest.findFirst({ orderBy: { createdAt: 'desc' } }),
    ]);

    const coverage = coverageManifest
      ? {
          locationsIncluded: coverageManifest.locationsIncluded,
          locationsOmitted: coverageManifest.locationsOmitted,
          extractionCutoff: coverageManifest.extractionCutoff,
          dataWatermark: coverageManifest.dataWatermark,
          knownMissingFeeds: coverageManifest.knownMissingFeeds,
          coverageStatus: coverageManifest.coverageStatus,
        }
      : {
          locationsIncluded: [],
          locationsOmitted: [],
          extractionCutoff: asOf,
          dataWatermark: asOf,
          knownMissingFeeds: [],
          coverageStatus: 'COMPLETE',
        };

    const input: ReconciliationInput = {
      organizationId,
      screens: screens.map((s) => ({
        ...s,
        provenanceHash: s.provenanceHash,
      })),
      assessments: assessments.map((a) => ({
        ...a,
        provenanceHash: a.provenanceHash,
      })),
      protocolVersions: protocolVersions.map((pv) => ({
        id: pv.id,
        organizationId: pv.organizationId,
        version: pv.version,
        effectiveFrom: pv.effectiveFrom,
        effectiveTo: pv.effectiveTo,
        timezone: pv.timezone,
        calendarVersion: pv.calendarVersion,
        measureDefinitions: pv.measureDefinitions.map((md) => ({
          id: md.id,
          version: md.version,
          protocolVersionId: md.protocolVersionId,
          populationMinAge: md.populationMinAge,
          settingFilter: md.settingFilter,
          eligibilityRule: md.eligibilityRule,
          qualifyingAssessment: md.qualifyingAssessment,
          linkageRules: md.linkageRules,
          reportingIntervalDays: md.reportingIntervalDays,
          timeAnchor: md.timeAnchor,
          boundaryInclusivity: md.boundaryInclusivity,
          duplicatePolicy: md.duplicatePolicy,
          exclusionPolicy: md.exclusionPolicy,
        })),
      })),
      coverage,
      calendar: ReconciliationService.DEFAULT_CALENDAR,
      asOf,
      engineVersion: ReconciliationService.ENGINE_VERSION,
    };

    const result = reconcile(input);

    // Capture knowledge snapshot — list of indexed source IDs at run time
    const [sourceArtifacts, knowledgeDocs] = await Promise.all([
      this.prisma.sourceArtifact.findMany({
        where: { organizationId, hydraSourceId: { not: null } },
        select: { id: true, hydraSourceId: true, title: true, kind: true },
      }),
      this.prisma.knowledgeDocument.findMany({
        where: { organizationId, indexingStatus: 'completed' },
        select: { id: true, hydraSourceId: true, title: true },
      }),
    ]);

    const knowledgeSnapshot = {
      capturedAt: new Date().toISOString(),
      sources: sourceArtifacts.map((s) => ({
        id: s.id,
        hydraSourceId: s.hydraSourceId,
        title: s.title,
        kind: s.kind,
      })),
      documents: knowledgeDocs.map((d) => ({
        id: d.id,
        hydraSourceId: d.hydraSourceId,
        title: d.title,
      })),
    };

    const run = await this.prisma.reconciliationRun.create({
      data: {
        organizationId,
        configurationHash: result.configurationHash,
        engineVersion: result.engineVersion,
        asOf: result.asOf,
        extractionHash: result.extractionHash,
        decisionsJson: JSON.parse(JSON.stringify(result.decisions)),
        summaryJson: JSON.parse(JSON.stringify(result.summary)),
        knowledgeSnapshotJson: knowledgeSnapshot,
      },
    });

    this.logger.log(
      `Reconciliation run ${run.id} created for org ${organizationId}: ${result.summary.totalScreens} screens, ${result.summary.eligible} eligible`,
    );

    return this.toDetailAsync(run, organizationId);
  }

  async listRuns(
    userId: string,
    organizationId: string,
  ): Promise<ReconciliationRunListDto> {
    await this.requireRole(userId, organizationId, 'list');

    const runs = await this.prisma.reconciliationRun.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      items: runs.map((r) => this.toSummary(r)),
      total: runs.length,
    };
  }

  async getRun(
    userId: string,
    organizationId: string,
    runId: string,
  ): Promise<ReconciliationRunDetailDto> {
    await this.requireRole(userId, organizationId, 'view');
    const run = await this.loadScoped(organizationId, runId);
    return this.toDetailAsync(run, organizationId);
  }

  async exportRun(
    userId: string,
    organizationId: string,
    runId: string,
    format: 'json' | 'csv' = 'json',
  ): Promise<{ contentType: string; data: string }> {
    await this.requireRole(userId, organizationId, 'export');
    const run = await this.loadScoped(organizationId, runId);

    if (format === 'csv') {
      return {
        contentType: 'text/csv',
        data: this.toCsv(run),
      };
    }

    return {
      contentType: 'application/json',
      data: JSON.stringify(this.toDetail(run), null, 2),
    };
  }

  private toCsv(run: ReconciliationRun): string {
    const decisions = run.decisionsJson as Array<Record<string, unknown>>;
    if (!Array.isArray(decisions) || decisions.length === 0) {
      return '';
    }

    const headers = Object.keys(decisions[0]);
    const rows = decisions.map((d) =>
      headers.map((h) => {
        const val = d[h];
        const str = val === null || val === undefined ? '' : String(val);
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(','),
    );

    return [headers.join(','), ...rows].join('\n');
  }

  private async loadScoped(
    organizationId: string,
    runId: string,
  ): Promise<ReconciliationRun> {
    const run = await this.prisma.reconciliationRun.findFirst({
      where: { id: runId, organizationId },
    });

    if (!run) {
      throw new ReconciliationRunNotFoundException(runId);
    }

    return run;
  }

  private async requireRole(
    userId: string,
    organizationId: string,
    action: string,
  ): Promise<void> {
    const role = await this.organizationsService.getUserRoleInOrganization(
      userId,
      organizationId,
    );

    if (!role || !ReconciliationService.ALLOWED_ROLES.includes(role)) {
      throw new ReconciliationAccessDeniedException(action);
    }
  }

  private toSummary(run: ReconciliationRun): ReconciliationRunSummaryDto {
    const summary = run.summaryJson as Record<string, number> | null;
    return {
      id: run.id,
      createdAt: run.createdAt.toISOString(),
      asOf: run.asOf.toISOString(),
      configHash: run.configurationHash,
      engineVersion: run.engineVersion,
      protocolVersionId: (run as any).protocolVersionId ?? '',
      counts: {
        eligible: summary?.eligible ?? 0,
        notEligible: summary?.notEligible ?? 0,
        indeterminate: summary?.indeterminate ?? 0,
        invalid: summary?.invalid ?? 0,
        mature: summary?.matureEligible ?? summary?.mature ?? 0,
        immature: summary?.immature ?? 0,
        withinWindow: summary?.withinWindow ?? 0,
        outsideWindow: summary?.outsideWindow ?? 0,
        ambiguous: summary?.ambiguous ?? 0,
        partial: summary?.partial ?? 0,
        absent: summary?.absentLink ?? summary?.absent ?? 0,
        coverageUnknown: summary?.coverageUnknown ?? 0,
      },
    };
  }

  private async toDetailAsync(
    run: ReconciliationRun,
    organizationId: string,
  ): Promise<ReconciliationRunDetailDto> {
    const rawDecisions = (run.decisionsJson as any[]) ?? [];

    // Enrich decisions with screen data
    const screenIds = rawDecisions.map((d) => d.screeningEventId).filter(Boolean);
    const screens = screenIds.length > 0
      ? await this.prisma.screeningEvent.findMany({
          where: { id: { in: screenIds }, organizationId },
        })
      : [];
    const screenMap = new Map(screens.map((s) => [s.id, s]));

    const decisions = rawDecisions.map((d) => {
      const screen = screenMap.get(d.screeningEventId);
      return {
        id: d.screeningEventId,
        screeningEventId: d.screeningEventId,
        syntheticPatientId: screen?.syntheticPatientId ?? '',
        encounterId: screen?.encounterId ?? '',
        occurredAt: screen?.occurredAt?.toISOString() ?? '',
        eligibilityState: d.eligibility ?? d.eligibilityState ?? 'INVALID',
        linkageState: d.linkage ?? d.linkageState ?? null,
        reasonCodes: d.eligibilityReason
          ? [d.eligibilityReason, d.linkageReason].filter(Boolean)
          : [],
        linkedAssessmentId: d.linkedAssessmentId ?? null,
        candidateAssessmentIds: d.candidateAssessmentIds ?? [],
        ruleVersion: d.measureDefinitionId ?? '',
        reviewStatus: 'OPEN',
        isMature: d.isMature ?? true,
        coverageStatus: null,
        effectiveFrom: null,
        effectiveTo: null,
        sourceArtifactId: null,
      };
    });

    return {
      ...this.toSummary(run),
      decisions,
      coverageManifest: null,
      knowledgeSnapshot: run.knowledgeSnapshotJson ?? null,
    };
  }

  /** Sync version for export (no enrichment) */
  private toDetail(run: ReconciliationRun): ReconciliationRunDetailDto {
    return {
      ...this.toSummary(run),
      decisions: (run.decisionsJson as unknown[]) ?? [],
      coverageManifest: null,
      knowledgeSnapshot: run.knowledgeSnapshotJson ?? null,
    };
  }
}
