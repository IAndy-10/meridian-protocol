'use client';

import { use, useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Loader2,
  Search,
  ArrowLeft,
  ExternalLink,
  BookOpen,
  FlaskConical,
  FileText,
  ArrowRight,
  Network,
  Lightbulb,
  ChevronRight,
  X,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { sourcesApi, type SourceArtifact, type SourceSearchResult } from '@/lib/api/sources';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ organizationId: string }>;
}

const KIND_CONFIG: Record<string, { icon: typeof BookOpen; label: string; color: string; bg: string }> = {
  PUBLICATION: { icon: BookOpen, label: 'Publication', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  SYNTHETIC_PROCEDURE: { icon: FlaskConical, label: 'Synthetic Procedure', color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200' },
  LOCAL_APPROVED_POLICY: { icon: FileText, label: 'Local Policy', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
};

const SUGGESTED_QUERIES = [
  'What counts as a completed C-SSRS assessment?',
  'Two business day reporting window',
  'PHQ-9 item 9 eligibility criteria',
  'How to handle ambiguous linkage',
];

function RelevanceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const colorClass = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-slate-400';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
        <div className={`h-full rounded-full transition-all ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground">{pct}%</span>
    </div>
  );
}

function KindIcon({ kind }: { kind: string }) {
  const cfg = KIND_CONFIG[kind] ?? KIND_CONFIG.PUBLICATION;
  const Icon = cfg.icon;
  return <Icon className={`h-4 w-4 ${cfg.color}`} />;
}

function SourceCard({
  source,
  isSelected,
  onSelect,
  connectionCount,
}: {
  source: SourceArtifact;
  isSelected: boolean;
  onSelect: () => void;
  connectionCount: number;
}) {
  const cfg = KIND_CONFIG[source.kind] ?? KIND_CONFIG.PUBLICATION;

  return (
    <button
      onClick={onSelect}
      className={`group w-full rounded-lg border p-4 text-left transition-all hover:shadow-md ${
        isSelected
          ? 'border-primary bg-primary/5 shadow-md ring-1 ring-primary/20'
          : 'border-border hover:border-primary/30'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${cfg.bg}`}>
          <KindIcon kind={source.kind} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-tight line-clamp-2">{source.title}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {cfg.label}
            </Badge>
            {connectionCount > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Network className="h-2.5 w-2.5" />
                {connectionCount} connection{connectionCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          {source.excerpt && (
            <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
              {source.excerpt}
            </p>
          )}
        </div>
        <ChevronRight className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isSelected ? 'rotate-90' : 'group-hover:translate-x-0.5'}`} />
      </div>
    </button>
  );
}

function ConnectionLine({ from, to, label }: { from: string; to: string; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded border border-dashed border-muted-foreground/30 bg-muted/30 px-3 py-2">
      <span className="truncate text-xs font-medium">{from}</span>
      <div className="flex shrink-0 items-center gap-1 text-muted-foreground">
        <div className="h-px w-4 bg-muted-foreground/40" />
        <span className="text-[10px] italic">{label}</span>
        <ArrowRight className="h-3 w-3" />
      </div>
      <span className="truncate text-xs font-medium">{to}</span>
    </div>
  );
}

function SearchResultCard({
  result,
  onSelect,
  rank,
}: {
  result: SourceSearchResult;
  onSelect: () => void;
  rank: number;
}) {
  return (
    <button
      onClick={onSelect}
      className="group w-full rounded-lg border p-4 text-left transition-all hover:border-primary/30 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
          {rank}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium line-clamp-1">{result.title}</p>
            <RelevanceBar score={result.score} />
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground line-clamp-3">
            {result.passage}
          </p>
          {result.sectionLocator && (
            <span className="mt-1 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              {result.sectionLocator}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export default function SourcesPage({ params }: PageProps) {
  const { organizationId } = use(params);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('explore');

  const { data: sources, isLoading } = useQuery({
    queryKey: ['sources', organizationId],
    queryFn: () => sourcesApi.list(organizationId),
  });

  const searchMutation = useMutation({
    mutationFn: (query: string) =>
      sourcesApi.search(organizationId, { query, limit: 10 }),
  });

  const { data: selectedSource } = useQuery({
    queryKey: ['source', organizationId, selectedSourceId],
    queryFn: () => sourcesApi.get(organizationId, selectedSourceId!),
    enabled: !!selectedSourceId,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setActiveTab('search');
    searchMutation.mutate(searchQuery);
  };

  const handleSuggestedQuery = (q: string) => {
    setSearchQuery(q);
    setActiveTab('search');
    searchMutation.mutate(q);
  };

  // Derive connections between sources
  const { connections, connectionCounts } = useMemo(() => {
    if (!sources) return { connections: [] as { from: string; to: string; fromTitle: string; toTitle: string; label: string }[], connectionCounts: new Map<string, number>() };

    const pubs = sources.filter((s) => s.kind === 'PUBLICATION');
    const procs = sources.filter((s) => s.kind !== 'PUBLICATION');
    const conns: { from: string; to: string; fromTitle: string; toTitle: string; label: string }[] = [];

    // Every procedure references publications as evidence base
    for (const proc of procs) {
      for (const pub of pubs) {
        conns.push({
          from: pub.id,
          to: proc.id,
          fromTitle: pub.title.split('—')[0]?.trim() ?? pub.title,
          toTitle: proc.title.split('—')[0]?.trim() ?? proc.title,
          label: 'informs',
        });
      }
    }

    // Build count map
    const counts = new Map<string, number>();
    for (const c of conns) {
      counts.set(c.from, (counts.get(c.from) ?? 0) + 1);
      counts.set(c.to, (counts.get(c.to) ?? 0) + 1);
    }

    return { connections: conns, connectionCounts: counts };
  }, [sources]);

  // Sources relevant to the selected one
  const relatedConnections = useMemo(() => {
    if (!selectedSourceId) return [];
    return connections.filter((c) => c.from === selectedSourceId || c.to === selectedSourceId);
  }, [connections, selectedSourceId]);

  // Summary stats
  const stats = useMemo(() => {
    if (!sources) return null;
    return {
      total: sources.length,
      publications: sources.filter((s) => s.kind === 'PUBLICATION').length,
      procedures: sources.filter((s) => s.kind === 'SYNTHETIC_PROCEDURE').length,
      policies: sources.filter((s) => (s.kind as string) === 'LOCAL_APPROVED_POLICY').length,
      withHydra: sources.filter((s) => s.hydraSourceId).length,
    };
  }, [sources]);

  if (isLoading) {
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
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <PageHeader
          title="Company Brain"
          description="Explore source evidence, discover connections, and find the reasoning behind every rule"
        >
          <Button variant="outline" asChild>
            <Link href={`/organizations/${organizationId}/reconciliation`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Reconciliation
            </Link>
          </Button>
        </PageHeader>

        {/* Stats row */}
        {stats && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100">
                  <FileText className="h-4 w-4 text-slate-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold leading-none">{stats.total}</p>
                  <p className="text-[10px] text-muted-foreground">Total Sources</p>
                </div>
              </div>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-50">
                  <BookOpen className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold leading-none">{stats.publications}</p>
                  <p className="text-[10px] text-muted-foreground">Publications</p>
                </div>
              </div>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-violet-50">
                  <FlaskConical className="h-4 w-4 text-violet-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold leading-none">{stats.procedures}</p>
                  <p className="text-[10px] text-muted-foreground">Procedures</p>
                </div>
              </div>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-50">
                  <Network className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold leading-none">{connections.length}</p>
                  <p className="text-[10px] text-muted-foreground">Connections</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Ask the brain anything — e.g. &quot;What triggers a C-SSRS assessment?&quot;"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button type="submit" disabled={searchMutation.isPending}>
                {searchMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Search
              </Button>
            </form>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {SUGGESTED_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSuggestedQuery(q)}
                  className="rounded-full border bg-muted/50 px-3 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                >
                  {q}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Main content */}
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Left panel: tabs */}
          <div className="lg:col-span-3">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full">
                <TabsTrigger value="explore" className="flex-1">
                  <Network className="mr-1.5 h-3.5 w-3.5" />
                  Explore
                </TabsTrigger>
                <TabsTrigger value="search" className="flex-1">
                  <Search className="mr-1.5 h-3.5 w-3.5" />
                  Results
                  {searchMutation.data && (
                    <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                      {searchMutation.data.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="connections" className="flex-1">
                  <Lightbulb className="mr-1.5 h-3.5 w-3.5" />
                  Connections
                </TabsTrigger>
              </TabsList>

              {/* Explore tab — source cards */}
              <TabsContent value="explore" className="space-y-3">
                {sources?.map((s) => (
                  <SourceCard
                    key={s.id}
                    source={s}
                    isSelected={selectedSourceId === s.id}
                    onSelect={() => setSelectedSourceId(selectedSourceId === s.id ? null : s.id)}
                    connectionCount={connectionCounts.get(s.id) ?? 0}
                  />
                ))}
              </TabsContent>

              {/* Search results tab */}
              <TabsContent value="search" className="space-y-3">
                {searchMutation.isPending && (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}
                {searchMutation.data && searchMutation.data.length > 0 && (
                  searchMutation.data.map((result, idx) => (
                    <SearchResultCard
                      key={`${result.sourceArtifactId}-${idx}`}
                      result={result}
                      onSelect={() => {
                        setSelectedSourceId(result.sourceArtifactId);
                      }}
                      rank={idx + 1}
                    />
                  ))
                )}
                {searchMutation.data && searchMutation.data.length === 0 && (
                  <div className="rounded-lg border border-dashed p-8 text-center">
                    <Search className="mx-auto h-8 w-8 text-muted-foreground/50" />
                    <p className="mt-2 text-sm text-muted-foreground">No matching passages found.</p>
                    <p className="mt-1 text-xs text-muted-foreground">Try a different question or browse the Explore tab.</p>
                  </div>
                )}
                {!searchMutation.data && !searchMutation.isPending && (
                  <div className="rounded-lg border border-dashed p-8 text-center">
                    <Sparkles className="mx-auto h-8 w-8 text-muted-foreground/50" />
                    <p className="mt-2 text-sm text-muted-foreground">Search across all source documents.</p>
                    <p className="mt-1 text-xs text-muted-foreground">Try one of the suggested queries above or type your own.</p>
                  </div>
                )}
              </TabsContent>

              {/* Connections tab — visual map */}
              <TabsContent value="connections" className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Evidence Flow</CardTitle>
                    <CardDescription className="text-xs">
                      How published research informs synthetic procedures
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {connections.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No connections found.</p>
                    ) : (
                      connections.map((c, i) => (
                        <ConnectionLine key={i} from={c.fromTitle} to={c.toTitle} label={c.label} />
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* Next steps */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-1.5">
                      <Lightbulb className="h-4 w-4 text-amber-500" />
                      Suggested Next Steps
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2 rounded border p-3">
                        <div className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-blue-100 text-center text-[10px] font-bold leading-5 text-blue-700">1</div>
                        <div>
                          <p className="text-sm font-medium">Run reconciliation</p>
                          <p className="text-xs text-muted-foreground">
                            Execute the engine against loaded screens and assessments to see which rules fire.
                          </p>
                          <Button variant="outline" size="sm" className="mt-2" asChild>
                            <Link href={`/organizations/${organizationId}/reconciliation`}>
                              Go to Reconciliation <ArrowRight className="ml-1 h-3 w-3" />
                            </Link>
                          </Button>
                        </div>
                      </li>
                      <li className="flex items-start gap-2 rounded border p-3">
                        <div className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-violet-100 text-center text-[10px] font-bold leading-5 text-violet-700">2</div>
                        <div>
                          <p className="text-sm font-medium">Review ambiguous decisions</p>
                          <p className="text-xs text-muted-foreground">
                            After a run, check decisions marked AMBIGUOUS_LINKAGE and trace them back to the relevant source passages here.
                          </p>
                        </div>
                      </li>
                      <li className="flex items-start gap-2 rounded border p-3">
                        <div className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-emerald-100 text-center text-[10px] font-bold leading-5 text-emerald-700">3</div>
                        <div>
                          <p className="text-sm font-medium">Search for rule justification</p>
                          <p className="text-xs text-muted-foreground">
                            Use the search bar to find the exact passage that defines a rule — e.g. &quot;two business day window&quot; traces to Coleman et al.
                          </p>
                        </div>
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right panel: detail */}
          <div className="lg:col-span-2">
            {selectedSource ? (
              <Card className="sticky top-6">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <KindIcon kind={selectedSource.kind} />
                      <CardTitle className="text-sm leading-tight">{selectedSource.title}</CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 shrink-0 p-0"
                      onClick={() => setSelectedSourceId(null)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Synthetic warning */}
                  {selectedSource.kind === 'SYNTHETIC_PROCEDURE' && (
                    <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-900">
                      SYNTHETIC — NOT AN APPROVED CLINICAL PROCEDURE
                    </div>
                  )}

                  {/* Meta */}
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-[10px]">
                      {KIND_CONFIG[selectedSource.kind]?.label ?? selectedSource.kind}
                    </Badge>
                    {selectedSource.hydraSourceId && (
                      <Badge variant="outline" className="text-[10px] border-emerald-200 text-emerald-700">
                        Indexed
                      </Badge>
                    )}
                  </div>

                  {/* External link */}
                  {selectedSource.url && (
                    <a
                      href={selectedSource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      View original source <ExternalLink className="h-3 w-3" />
                    </a>
                  )}

                  {/* Excerpt */}
                  {selectedSource.excerpt && (
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Key Finding</p>
                      <div className="rounded border-l-2 border-primary/30 bg-muted/30 p-3">
                        <p className="text-xs leading-relaxed">{selectedSource.excerpt}</p>
                      </div>
                    </div>
                  )}

                  {/* Full text */}
                  {selectedSource.fullText && (
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Full Text</p>
                      <div className="max-h-64 overflow-y-auto rounded border bg-muted/20 p-3 text-xs font-mono leading-relaxed whitespace-pre-wrap">
                        {selectedSource.fullText}
                      </div>
                    </div>
                  )}

                  {/* Connections from this source */}
                  {relatedConnections.length > 0 && (
                    <div>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Connections ({relatedConnections.length})
                      </p>
                      <div className="space-y-1.5">
                        {relatedConnections.map((c, i) => {
                          const otherId = c.from === selectedSourceId ? c.to : c.from;
                          const otherTitle = c.from === selectedSourceId ? c.toTitle : c.fromTitle;
                          const direction = c.from === selectedSourceId ? 'Informs' : 'Informed by';
                          return (
                            <button
                              key={i}
                              onClick={() => setSelectedSourceId(otherId)}
                              className="flex w-full items-center gap-2 rounded border px-3 py-2 text-left transition-colors hover:bg-muted/50"
                            >
                              <ArrowRight className={`h-3 w-3 shrink-0 text-muted-foreground ${c.to === selectedSourceId ? 'rotate-180' : ''}`} />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-medium">{otherTitle}</p>
                                <p className="text-[10px] text-muted-foreground">{direction}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Content hash */}
                  <div className="border-t pt-3">
                    <p className="text-[10px] text-muted-foreground">
                      Hash: <span className="font-mono">{selectedSource.contentHash}</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Network className="h-10 w-10 text-muted-foreground/30" />
                  <p className="mt-3 text-sm text-muted-foreground">Select a source to see details</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Click any source card or search result
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
