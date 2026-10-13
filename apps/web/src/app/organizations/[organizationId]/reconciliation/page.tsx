'use client';

import React, { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Play, FileJson, FileSpreadsheet, Search, ChevronDown, ChevronRight, AlertCircle, LayoutList, BarChart3, HelpCircle, ArrowRight, Clock, Calendar } from 'lucide-react';
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

  const provenanceQueryText = [
    decision.eligibilityState,
    decision.linkageState,
    ...decision.reasonCodes,
  ].filter(Boolean).join(' ');

  const { data: provenancePassages } = useQuery({
    queryKey: ['provenance', orgId, decision.id],
    queryFn: () =>
      sourcesApi.provenance(
        orgId,
        decision.reasonCodes,
        provenanceQueryText,
      ),
    enabled: decision.reasonCodes.length > 0 || !!decision.linkageState,
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

// --- Donut Chart (SVG) ---

const DONUT_SEGMENTS: Array<{ key: string; label: string; color: string }> = [
  { key: 'withinWindow', label: 'Within window', color: '#3b82f6' },
  { key: 'outsideWindow', label: 'Outside window', color: '#f59e0b' },
  { key: 'ambiguous', label: 'Ambiguous', color: '#9ca3af' },
  { key: 'absent', label: 'No linked record', color: '#d1d5db' },
  { key: 'partial', label: 'Partial', color: '#c4b5fd' },
  { key: 'coverageUnknown', label: 'Coverage unknown', color: '#e5e7eb' },
];

const DonutChart = ({ counts }: { counts: ReconciliationRun['counts'] }) => {
  const total = counts.mature || 1;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const segments = DONUT_SEGMENTS
    .map((seg) => {
      const value = counts[seg.key as keyof typeof counts] as number;
      const pct = value / total;
      const dashLength = pct * circumference;
      const segment = { ...seg, value, pct, dashLength, offset };
      offset += dashLength;
      return segment;
    })
    .filter((s) => s.value > 0);

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 100 100" className="h-32 w-32 -rotate-90">
        {segments.map((seg) => (
          <circle
            key={seg.key}
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth="16"
            strokeDasharray={`${seg.dashLength} ${circumference - seg.dashLength}`}
            strokeDashoffset={-seg.offset}
          />
        ))}
        {segments.length === 0 && (
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="16" />
        )}
      </svg>
      <div className="flex flex-col gap-1">
        {segments.map((seg) => (
          <div key={seg.key} className="flex items-center gap-2 text-xs">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
            <span className="text-muted-foreground">{seg.label}</span>
            <span className="font-medium">{seg.value}</span>
            <span className="text-muted-foreground">({(seg.pct * 100).toFixed(0)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Summary Dashboard ---

const SummaryDashboard = ({ run }: { run: ReconciliationRun }) => {
  const { counts } = run;
  const matureEligible = counts.mature;
  const proportion = matureEligible > 0
    ? (counts.withinWindow / matureEligible)
    : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold">{counts.eligible + counts.notEligible + counts.indeterminate + counts.invalid}</p>
            <p className="text-xs text-muted-foreground">Total Screens</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold">{counts.eligible}</p>
            <p className="text-xs text-muted-foreground">Eligible</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold">{matureEligible}</p>
            <p className="text-xs text-muted-foreground">Mature Eligible</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold">
              {proportion !== null ? `${(proportion * 100).toFixed(1)}%` : '—'}
            </p>
            <p className="text-xs text-muted-foreground">
              Observed Linkage
              {proportion !== null && (
                <span className="ml-1 font-mono">({counts.withinWindow}/{matureEligible})</span>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Linkage Outcome Distribution (Mature Eligible)</CardTitle>
        </CardHeader>
        <CardContent>
          <DonutChart counts={counts} />
        </CardContent>
      </Card>
    </div>
  );
};

// --- Connector colors ---

const CONNECTOR_STYLE: Record<string, { color: string; dash: boolean; icon: React.ReactNode | null }> = {
  QUALIFYING_RECORD_LINKED_WITHIN_WINDOW: { color: '#3b82f6', dash: false, icon: null },
  QUALIFYING_RECORD_LINKED_OUTSIDE_WINDOW: { color: '#f59e0b', dash: false, icon: null },
  NO_LINKED_RECORD_IN_AVAILABLE_DATA: { color: '#9ca3af', dash: true, icon: null },
  AMBIGUOUS_LINKAGE: { color: '#9ca3af', dash: true, icon: <HelpCircle className="h-3.5 w-3.5 text-gray-500" /> },
  PARTIAL_OR_NONQUALIFYING_RECORD: { color: '#c4b5fd', dash: true, icon: null },
  NOT_YET_EVALUABLE: { color: '#d1d5db', dash: true, icon: <Clock className="h-3.5 w-3.5 text-gray-400" /> },
  DATA_COVERAGE_UNKNOWN: { color: '#e5e7eb', dash: true, icon: <AlertCircle className="h-3.5 w-3.5 text-gray-400" /> },
};

// --- Timeline ---

const BusinessDayTimeline = ({ decision }: { decision: ReconciliationDecision }) => {
  const screenDate = new Date(decision.occurredAt);

  // Simple business-day forward calculation for display
  const addBusinessDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    let added = 0;
    while (added < days) {
      result.setDate(result.getDate() + 1);
      const day = result.getDay();
      if (day !== 0 && day !== 6) added++;
    }
    return result;
  };

  const deadline = addBusinessDays(screenDate, 2);

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  // Calculate days between screen and assessment for positioning
  const linkedId = decision.linkedAssessmentId;
  const isImmature = decision.linkageState === 'NOT_YET_EVALUABLE';

  return (
    <div className="mt-2 rounded border bg-muted/20 p-3">
      <div className="relative flex items-center gap-0 text-xs">
        {/* Screen marker */}
        <div className="flex flex-col items-center">
          <div className="h-3 w-3 rounded-full bg-blue-500" />
          <span className="mt-1 font-mono text-[10px]">{formatDate(screenDate)}</span>
          <span className="text-[10px] text-muted-foreground">Screen</span>
        </div>

        {/* Timeline bar */}
        <div className="mx-2 flex-1">
          <div className="relative h-1 rounded-full bg-gray-200">
            <div className="absolute left-0 top-0 h-1 rounded-full bg-blue-300" style={{ width: '50%' }} />
            <div className="absolute left-[50%] top-0 h-1 rounded-full bg-amber-200" style={{ width: '50%' }} />
          </div>
          <div className="mt-0.5 flex justify-between text-[10px] text-muted-foreground">
            <span>biz day 1</span>
            <span>biz day 2</span>
          </div>
        </div>

        {/* Deadline marker */}
        <div className="flex flex-col items-center">
          <div className="h-3 w-3 rounded-full border-2 border-amber-500 bg-white" />
          <span className="mt-1 font-mono text-[10px]">{formatDate(deadline)}</span>
          <span className="text-[10px] text-muted-foreground">Deadline</span>
        </div>
      </div>

      {/* Assessment position indicator */}
      {linkedId && decision.linkageState === 'QUALIFYING_RECORD_LINKED_WITHIN_WINDOW' && (
        <div className="mt-2 text-xs text-blue-700">
          ✓ Assessment linked within window
        </div>
      )}
      {linkedId && decision.linkageState === 'QUALIFYING_RECORD_LINKED_OUTSIDE_WINDOW' && (
        <div className="mt-2 text-xs text-amber-700">
          Assessment linked but outside the 2 business-day window
        </div>
      )}
      {isImmature && (
        <div className="mt-2 text-xs text-gray-500">
          <Clock className="mr-1 inline h-3 w-3" />
          Deadline is in the future — not yet evaluable
        </div>
      )}
    </div>
  );
};

// --- Pairing Card ---

const PairingCard = ({
  decision,
  orgId,
  runId,
}: {
  decision: ReconciliationDecision;
  orgId: string;
  runId: string;
}) => {
  const [expanded, setExpanded] = useState(false);
  const linkBadge = decision.linkageState ? LINKAGE_BADGE[decision.linkageState] : null;
  const eligBadge = ELIGIBLE_BADGE[decision.eligibilityState];
  const connector = decision.linkageState ? CONNECTOR_STYLE[decision.linkageState] : null;
  const isAmbiguous = decision.linkageState === 'AMBIGUOUS_LINKAGE';
  const hasLink = !!decision.linkedAssessmentId;
  const isEligible = decision.eligibilityState === 'ELIGIBLE';

  return (
    <div className="rounded-lg border bg-card">
      <div
        className="flex cursor-pointer items-stretch gap-0 p-3"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
      >
        {/* Screen card (left) */}
        <div className="flex-1 rounded-md border bg-background p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">SCREEN</span>
            <Badge variant="outline" className={cn('text-[10px]', eligBadge?.className)}>
              {eligBadge?.label}
            </Badge>
          </div>
          <p className="mt-1 font-mono text-sm font-medium">{decision.syntheticPatientId}</p>
          <p className="text-xs text-muted-foreground">
            <Calendar className="mr-1 inline h-3 w-3" />
            {new Date(decision.occurredAt).toLocaleDateString()}
          </p>
          {decision.isMature !== undefined && (
            <span className="mt-1 inline-block text-[10px] text-muted-foreground">
              {decision.isMature ? 'Mature' : 'Immature'}
            </span>
          )}
        </div>

        {/* Connector */}
        <div className="flex w-16 flex-col items-center justify-center">
          {isEligible && connector ? (
            <>
              <svg className="h-1 w-full" viewBox="0 0 64 4">
                <line
                  x1="0" y1="2" x2="64" y2="2"
                  stroke={connector.color}
                  strokeWidth="2"
                  strokeDasharray={connector.dash ? '4 3' : 'none'}
                />
                <polygon points="58,0 64,2 58,4" fill={connector.color} />
              </svg>
              {connector.icon && <div className="mt-0.5">{connector.icon}</div>}
            </>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>

        {/* Assessment card (right) */}
        <div className={cn(
          'flex-1 rounded-md border p-3',
          hasLink ? 'bg-background' : 'border-dashed bg-muted/30',
        )}>
          {hasLink ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">ASSESSMENT</span>
                {linkBadge && (
                  <Badge variant="outline" className={cn('text-[10px]', linkBadge.className)}>
                    {linkBadge.label}
                  </Badge>
                )}
              </div>
              <p className="mt-1 font-mono text-xs">{decision.linkedAssessmentId}</p>
            </>
          ) : isAmbiguous ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">CANDIDATES</span>
                <HelpCircle className="h-3.5 w-3.5 text-gray-400" />
              </div>
              <div className="mt-1 space-y-1">
                {decision.candidateAssessmentIds.map((id) => (
                  <div key={id} className="rounded border border-dashed px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {id}
                  </div>
                ))}
              </div>
              <Badge variant="outline" className="mt-1 text-[10px] bg-gray-100 text-gray-700">
                Ambiguous — multiple candidates
              </Badge>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">ASSESSMENT</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground italic">
                {linkBadge?.label ?? 'No linkage evaluated'}
              </p>
            </>
          )}
        </div>

        {/* Expand indicator */}
        <div className="flex items-center pl-2">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Expanded: timeline + detail panel */}
      {expanded && (
        <div className="border-t px-3 pb-3">
          {isEligible && <BusinessDayTimeline decision={decision} />}
          <DetailPanel decision={decision} orgId={orgId} runId={runId} />
        </div>
      )}
    </div>
  );
};

// --- Pairing View ---

const PairingView = ({
  decisions,
  orgId,
  runId,
}: {
  decisions: ReconciliationDecision[];
  orgId: string;
  runId: string;
}) => {
  return (
    <div className="space-y-3">
      {decisions.map((d) => (
        <PairingCard key={d.id} decision={d} orgId={orgId} runId={runId} />
      ))}
    </div>
  );
};

// --- Main Page ---

export default function ReconciliationPage({ params }: PageProps) {
  const { organizationId } = use(params);
  const queryClient = useQueryClient();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'visual'>('visual');

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

            {/* View toggle */}
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'visual' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('visual')}
              >
                <BarChart3 className="mr-1 h-4 w-4" />
                Visual
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('table')}
              >
                <LayoutList className="mr-1 h-4 w-4" />
                Table
              </Button>
            </div>

            {viewMode === 'visual' ? (
              <>
                <SummaryDashboard run={run} />
                <PairingView decisions={run.decisions} orgId={organizationId} runId={run.id} />
              </>
            ) : (
              <>
                <CountTable run={run} />
                <EventList decisions={run.decisions} orgId={organizationId} runId={run.id} />
              </>
            )}
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
