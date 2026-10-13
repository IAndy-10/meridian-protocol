'use client';

import { use, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Loader2, Search, ArrowLeft, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { sourcesApi, type SourceArtifact, type SourceSearchResult } from '@/lib/api/sources';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ organizationId: string }>;
}

export default function SourcesPage({ params }: PageProps) {
  const { organizationId } = use(params);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);

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
    searchMutation.mutate(searchQuery);
  };

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
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <PageHeader
          title="Source Documents"
          description="Search ingested protocol documents and publications"
        >
          <Button variant="outline" asChild>
            <Link href={`/organizations/${organizationId}/reconciliation`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to reconciliation
            </Link>
          </Button>
        </PageHeader>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            placeholder="Search source documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-lg"
          />
          <Button type="submit" disabled={searchMutation.isPending}>
            {searchMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            Search
          </Button>
        </form>

        {/* Search results */}
        {searchMutation.data && searchMutation.data.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Search Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {searchMutation.data.map((result: SourceSearchResult, idx: number) => (
                <div
                  key={`${result.sourceArtifactId}-${idx}`}
                  className="cursor-pointer rounded border p-3 transition-colors hover:bg-muted/50"
                  onClick={() => setSelectedSourceId(result.sourceArtifactId)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedSourceId(result.sourceArtifactId);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{result.title}</span>
                    <span className="text-xs text-muted-foreground">
                      score: {result.score.toFixed(3)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-3">
                    {result.passage}
                  </p>
                  {result.sectionLocator && (
                    <span className="mt-1 text-xs font-mono text-muted-foreground">
                      {result.sectionLocator}
                    </span>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {searchMutation.data && searchMutation.data.length === 0 && (
          <p className="text-sm text-muted-foreground">No results found.</p>
        )}

        {/* Selected source detail */}
        {selectedSource && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{selectedSource.title}</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedSourceId(null)}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedSource.isSynthetic && (
                <div className="rounded border bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                  SYNTHETIC — NOT AN APPROVED CLINICAL PROCEDURE
                </div>
              )}
              <div className="flex gap-2">
                <Badge variant="outline">{selectedSource.kind.replace('_', ' ')}</Badge>
              </div>
              {selectedSource.url && (
                <a
                  href={selectedSource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                >
                  View source <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {selectedSource.excerpt && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Excerpt:</span>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{selectedSource.excerpt}</p>
                </div>
              )}
              {selectedSource.fullText && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Full text:</span>
                  <div className="mt-1 max-h-96 overflow-y-auto whitespace-pre-wrap rounded border bg-muted/30 p-3 text-xs font-mono">
                    {selectedSource.fullText}
                  </div>
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                Content hash: <span className="font-mono">{selectedSource.contentHash}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Source artifacts list */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All Source Artifacts</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Synthetic</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources?.map((s: SourceArtifact) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-sm">{s.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {s.kind.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {s.isSynthetic && (
                        <span className="text-xs text-amber-700">SYNTHETIC</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedSourceId(s.id)}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
