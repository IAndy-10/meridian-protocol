'use client';

import React, { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Play, FileJson, FileSpreadsheet, Search, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  reconciliationApi,
  type ReconciliationRun,
  type ReconciliationRunSummary,
  type ReconciliationDecision,
  type ReviewStatus,
  type ReviewAction,
} from '@/lib/api/reconciliation';
import { downloadAuthedFile } from '@/lib/download';
import { sourcesApi, type ProvenancePassage } from '@/lib/api/sources';
import { cn } from '@/lib/utils';

interface PageProps {
  params: Promise<{ organizationId: string }>;
}

// --- Linkage badge config (neutral colors only, no red/green) ---

const LINKAGE_BADGE: Record<string, { label: string; className: string }> = {
  QUALIFYING_RECORD_LINKED_WITHIN_WINDOW: {
    label: 'Within window',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  QUALIFYING_RECORD_LINKED_OUTSIDE_WINDOW: {
    label: 'Outside window',
    className: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  NO_LINKED_RECORD_IN_AVAILABLE_DATA: {
    label: 'No linked record in available data',
    className: 'bg-gray-100 text-gray-700 border-gray-200',
  },
  AMBIGUOUS_LINKAGE: {
    label: 'Ambiguous',
    className: 'bg-gray-100 text-gray-700 border-gray-200',
  },
  PARTIAL_OR_NONQUALIFYING_RECORD: {
    label: 'Partial',
    className: 'bg-gray-100 text-gray-700 border-gray-200',
  },
  NOT_YET_EVALUABLE: {
    label: 'Immature',
    className: 'bg-gray-50 text-gray-500 border-gray-150',
  },
  DATA_COVERAGE_UNKNOWN: {
    label: 'Coverage unknown',
    className: 'bg-gray-100 text-gray-600 border-gray-200',
  },
};

const REVIEW_BADGE: Record<ReviewStatus, { label: string; className: string }> = {
  OPEN: { label: 'Open', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  IN_REVIEW: { label: 'In review', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  CLOSED_WITH_REASON: { label: 'Closed', className: 'bg-gray-100 text-gray-700 border-gray-200' },
  REOPENED: { label: 'Reopened', className: 'bg-blue-50 text-blue-700 border-blue-200' },
};

const ELIGIBLE_BADGE: Record<string, { label: string; className: string }> = {
  ELIGIBLE: { label: 'Eligible', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  NOT_ELIGIBLE: { label: 'Not eligible', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  INDETERMINATE: { label: 'Indeterminate', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  INVALID: { label: 'Invalid', className: 'bg-gray-100 text-gray-600 border-gray-200' },
};

// --- Count Table ---

const CountTable = ({ run }: { run: ReconciliationRun }) => {
  const { counts } = run;
  const matureEligible = counts.mature;
  const proportion = matureEligible > 0
    ? (counts.withinWindow / matureEligible).toFixed(3)
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Membership Counts</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Count</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow><TableCell className="font-medium">Eligible</TableCell><TableCell className="text-right">{counts.eligible}</TableCell></TableRow>
            <TableRow><TableCell className="font-medium">Not eligible</TableCell><TableCell className="text-right">{counts.notEligible}</TableCell></TableRow>
            <TableRow><TableCell className="font-medium">Indeterminate</TableCell><TableCell className="text-right">{counts.indeterminate}</TableCell></TableRow>
            <TableRow><TableCell className="font-medium">Invalid</TableCell><TableCell className="text-right">{counts.invalid}</TableCell></TableRow>
            <TableRow className="border-t-2"><TableCell className="font-medium">Mature (eligible)</TableCell><TableCell className="text-right">{counts.mature}</TableCell></TableRow>
            <TableRow><TableCell className="font-medium">Immature</TableCell><TableCell className="text-right">{counts.immature}</TableCell></TableRow>
            <TableRow className="border-t-2"><TableCell className="font-medium">Within window</TableCell><TableCell className="text-right">{counts.withinWindow}</TableCell></TableRow>
            <TableRow><TableCell className="font-medium">Outside window</TableCell><TableCell className="text-right">{counts.outsideWindow}</TableCell></TableRow>
            <TableRow><TableCell className="font-medium">Ambiguous</TableCell><TableCell className="text-right">{counts.ambiguous}</TableCell></TableRow>
            <TableRow><TableCell className="font-medium">Partial / non-qualifying</TableCell><TableCell className="text-right">{counts.partial}</TableCell></TableRow>
            <TableRow><TableCell className="font-medium">No linked record in available data</TableCell><TableCell className="text-right">{counts.absent}</TableCell></TableRow>
            <TableRow><TableCell className="font-medium">Coverage unknown</TableCell><TableCell className="text-right">{counts.coverageUnknown}</TableCell></TableRow>
          </TableBody>
        </Table>
        {proportion !== null ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Conservative observed-linkage measure (not clinical compliance): {proportion} ({counts.withinWindow}/{matureEligible})
          </p>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Proportion suppressed (zero eligible-mature denominator).
          </p>
        )}
      </CardContent>
    </Card>
  );
};

// --- Detail Panel ---

const DetailPanel = ({
  decision,
  orgId,
  runId,
}: {
  decision: ReconciliationDecision;
  orgId: string;
  runId: string;
}) => {
  const queryClient = useQueryClient();
  const [reviewForm, setReviewForm] = useState({
    toStatus: '' as ReviewStatus | '',
    reason: '',
    evidenceReference: '',
  });

  const { data: reviewActions } = useQuery({
    queryKey: ['reviews', orgId, runId, decision.id],
    queryFn: () => reconciliationApi.getReviewActions(orgId, runId, decision.id),
  });

  const reviewMutation = useMutation({
    mutationFn: () =>
      reconciliationApi.createReviewAction(orgId, runId, decision.id, {
        toStatus: reviewForm.toStatus as ReviewStatus,
        reason: reviewForm.reason || undefined,
        evidenceReference: reviewForm.evidenceReference || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', orgId, runId, decision.id] });
      queryClient.invalidateQueries({ queryKey: ['reconciliation-run', orgId, runId] });
      setReviewForm({ toStatus: '', reason: '', evidenceReference: '' });
    },
  });

  const allowedTransitions: Record<string, ReviewStatus[]> = {
    OPEN: ['IN_REVIEW'],
    IN_REVIEW: ['CLOSED_WITH_REASON', 'REOPENED'],
    CLOSED_WITH_REASON: ['REOPENED'],
    REOPENED: ['IN_REVIEW'],
  };

  const nextStatuses = allowedTransitions[decision.reviewStatus] ?? [];

  const { data: sourceArtifact } = useQuery({
    queryKey: ['source-artifact', orgId, decision.sourceArtifactId],
    queryFn: () => sourcesApi.get(orgId, decision.sourceArtifactId!),
    enabled: !!decision.sourceArtifactId,
  });

  const { data: provenancePassages } = useQuery({
    queryKey: ['provenance', orgId, decision.id],
    queryFn: () => sourcesApi.provenance(orgId, decision.reasonCodes),
    enabled: decision.reasonCodes.length > 0,
  });

  return (
    <div className="space-y-4 border-t bg-muted/30 p-4">
      <div className="rounded border bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
        SYNTHETIC — NOT AN APPROVED CLINICAL PROCEDURE
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">Rule version:</span>{' '}
          <span className="font-mono">{decision.ruleVersion}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Effective dates:</span>{' '}
          {decision.effectiveFrom
            ? `${new Date(decision.effectiveFrom).toLocaleDateString()} — ${decision.effectiveTo ? new Date(decision.effectiveTo).toLocaleDateString() : 'open-ended'}`
            : 'N/A'}
        </div>
        <div>
          <span className="text-muted-foreground">Coverage:</span>{' '}
          {decision.coverageStatus ?? 'N/A'}
        </div>
        {decision.sourceArtifactId && (
          <div>
            <Link
              href={`/organizations/${orgId}/reconciliation/sources`}
              className="text-sm text-blue-600 hover:underline"
            >
              View source document
            </Link>
          </div>
        )}
      </div>

      {sourceArtifact?.excerpt && (
        <div className="text-sm">
          <span className="text-muted-foreground">Source passage:</span>
          <blockquote className="mt-1 border-l-2 border-blue-300 pl-3 text-xs italic text-muted-foreground">
            {sourceArtifact.excerpt}
          </blockquote>
        </div>
      )}

      {provenancePassages && provenancePassages.length > 0 && (
        <div className="text-sm">
          <span className="font-medium">Grounded in:</span>
          <div className="mt-1 space-y-2">
            {provenancePassages.map((p: ProvenancePassage, idx: number) => (
              <div key={idx} className="rounded border bg-blue-50/50 p-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-blue-800">{p.title}</span>
                  <span className="text-muted-foreground">
                    relevance: {(p.score * 100).toFixed(0)}%
                  </span>
                </div>
                <blockquote className="mt-1 border-l-2 border-blue-300 pl-2 text-xs italic text-muted-foreground line-clamp-3">
                  {p.text}
                </blockquote>
              </div>
            ))}
          </div>
        </div>
      )}

      {decision.reasonCodes.length > 0 && (
        <div className="text-sm">
          <span className="text-muted-foreground">Reason codes:</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {decision.reasonCodes.map((code) => (
              <Badge key={code} variant="outline" className="font-mono text-xs">
                {code}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {decision.candidateAssessmentIds.length > 0 && (
        <div className="text-sm">
          <span className="text-muted-foreground">Candidate assessments:</span>
          <ul className="mt-1 list-inside list-disc text-xs font-mono">
            {decision.candidateAssessmentIds.map((id) => (
              <li key={id}>{id}</li>
            ))}
          </ul>
        </div>
      )}

      {decision.linkedAssessmentId && (
        <div className="text-sm">
          <span className="text-muted-foreground">Linked assessment:</span>{' '}
          <span className="font-mono">{decision.linkedAssessmentId}</span>
        </div>
      )}

      {/* Review audit trail */}
      {reviewActions && reviewActions.length > 0 && (
        <div className="text-sm">
          <span className="font-medium">Review history</span>
          <div className="mt-1 space-y-1">
            {reviewActions.map((action: ReviewAction) => (
              <div key={action.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{new Date(action.performedAt).toLocaleString()}</span>
                <span>{action.fromStatus} → {action.toStatus}</span>
                {action.reason && <span>— {action.reason}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Review form */}
      {nextStatuses.length > 0 && (
        <div className="space-y-3 rounded border p-3">
          <span className="text-sm font-medium">Update review status</span>
          <p className="text-xs text-muted-foreground">
            Review annotations cannot modify source records, denominator, or numerator.
          </p>
          <div className="grid gap-2">
            <div>
              <Label htmlFor="toStatus" className="text-xs">New status</Label>
              <Select
                value={reviewForm.toStatus}
                onValueChange={(v) => setReviewForm((f) => ({ ...f, toStatus: v as ReviewStatus }))}
              >
                <SelectTrigger id="toStatus" className="h-8">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {nextStatuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {REVIEW_BADGE[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="reason" className="text-xs">Reason</Label>
              <Textarea
                id="reason"
                className="h-16"
                value={reviewForm.reason}
                onChange={(e) => setReviewForm((f) => ({ ...f, reason: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="evidence" className="text-xs">Evidence reference</Label>
              <Input
                id="evidence"
                className="h-8"
                value={reviewForm.evidenceReference}
                onChange={(e) => setReviewForm((f) => ({ ...f, evidenceReference: e.target.value }))}
              />
            </div>
            <Button
              size="sm"
              disabled={!reviewForm.toStatus || reviewMutation.isPending}
              onClick={() => reviewMutation.mutate()}
            >
              {reviewMutation.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Submit
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Event List ---

const EventList = ({
  decisions,
  orgId,
  runId,
}: {
  decisions: ReconciliationDecision[];
  orgId: string;
  runId: string;
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleToggle = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Screening Events</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Patient ID</TableHead>
              <TableHead>Screen Date</TableHead>
              <TableHead>Eligibility</TableHead>
              <TableHead>Linkage State</TableHead>
              <TableHead>Review Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {decisions.map((d) => {
              const isExpanded = expandedId === d.id;
              const linkBadge = d.linkageState ? LINKAGE_BADGE[d.linkageState] : null;
              const eligBadge = ELIGIBLE_BADGE[d.eligibilityState];
              const revBadge = REVIEW_BADGE[d.reviewStatus];

              return (
                <React.Fragment key={d.id}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() => handleToggle(d.id)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleToggle(d.id);
                      }
                    }}
                  >
                    <TableCell className="w-8 pr-0">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{d.syntheticPatientId}</TableCell>
                    <TableCell>{new Date(d.occurredAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('text-xs', eligBadge?.className)}>
                        {eligBadge?.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {linkBadge ? (
                        <Badge variant="outline" className={cn('text-xs', linkBadge.className)}>
                          {d.linkageState === 'DATA_COVERAGE_UNKNOWN' && (
                            <AlertCircle className="mr-1 h-3 w-3" />
                          )}
                          {linkBadge.label}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('text-xs', revBadge.className)}>
                        {revBadge.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={6} className="p-0">
                        <DetailPanel decision={d} orgId={orgId} runId={runId} />
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

// --- Main Page ---

export default function ReconciliationPage({ params }: PageProps) {
  const { organizationId } = use(params);
  const queryClient = useQueryClient();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const { data: runs, isLoading: runsLoading } = useQuery({
    queryKey: ['reconciliation-runs', organizationId],
    queryFn: () => reconciliationApi.listRuns(organizationId),
  });

  const activeRunId = selectedRunId ?? runs?.[0]?.id ?? null;

  const { data: run, isLoading: runLoading } = useQuery({
    queryKey: ['reconciliation-run', organizationId, activeRunId],
    queryFn: () => reconciliationApi.getRun(organizationId, activeRunId!),
    enabled: !!activeRunId,
  });

  const triggerMutation = useMutation({
    mutationFn: () => reconciliationApi.triggerRun(organizationId),
    onSuccess: (newRun) => {
      queryClient.invalidateQueries({ queryKey: ['reconciliation-runs', organizationId] });
      setSelectedRunId(newRun.id);
    },
  });

  const handleExport = async (format: 'json' | 'csv') => {
    if (!activeRunId) return;
    const ext = format === 'json' ? 'json' : 'csv';
    await downloadAuthedFile(
      `/api/organizations/${organizationId}/reconciliation/runs/${activeRunId}/export?format=${format}`,
      `reconciliation-run-${activeRunId}.${ext}`,
    );
  };

  if (runsLoading) {
    return (
      <PageContainer>
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <PageHeader
          title="Reconciliation"
          description="Screening-to-assessment reconciliation results"
        >
          <div className="flex gap-2">
            <Button
              onClick={() => triggerMutation.mutate()}
              disabled={triggerMutation.isPending}
            >
              {triggerMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Run reconciliation
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/organizations/${organizationId}/reconciliation/sources`}>
                <Search className="mr-2 h-4 w-4" />
                Sources
              </Link>
            </Button>
          </div>
        </PageHeader>

        {/* Run selector */}
        {runs && runs.length > 0 && (
          <div className="flex items-center gap-4">
            <Label className="text-sm text-muted-foreground">Run:</Label>
            <Select
              value={activeRunId ?? ''}
              onValueChange={(v) => setSelectedRunId(v)}
            >
              <SelectTrigger className="w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {runs.map((r: ReconciliationRunSummary) => (
                  <SelectItem key={r.id} value={r.id}>
                    {new Date(r.createdAt).toLocaleString()} — {r.configHash.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeRunId && (
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => handleExport('json')}>
                  <FileJson className="mr-1 h-4 w-4" />
                  JSON
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleExport('csv')}>
                  <FileSpreadsheet className="mr-1 h-4 w-4" />
                  CSV
                </Button>
              </div>
            )}
          </div>
        )}

        {runLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {run && (
          <>
            {/* Run metadata */}
            <Card>
              <CardContent className="py-3">
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                  <span>Engine: <span className="font-mono">{run.engineVersion}</span></span>
                  <span>Config hash: <span className="font-mono">{run.configHash}</span></span>
                  <span>As-of: {new Date(run.asOf).toLocaleString()}</span>
                </div>
                {run.coverageManifest && (
                  <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                    <span>Coverage: <span className="font-medium text-foreground">{run.coverageManifest.coverageStatus}</span></span>
                    <span>Extraction cutoff: {new Date(run.coverageManifest.extractionCutoff).toLocaleString()}</span>
                    {run.coverageManifest.knownMissingFeeds.length > 0 && (
                      <span className="flex items-center gap-1">
                        <AlertCircle className="h-3 w-3 text-amber-500" />
                        Missing feeds: {run.coverageManifest.knownMissingFeeds.join(', ')}
                      </span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <CountTable run={run} />
            <EventList decisions={run.decisions} orgId={organizationId} runId={run.id} />
          </>
        )}

        {!runsLoading && (!runs || runs.length === 0) && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No reconciliation runs yet. Click "Run reconciliation" to start.
            </CardContent>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
