'use client';

import React, { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  Upload,
  Trash2,
  RefreshCw,
  Search,
  BookOpen,
  FileText,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  knowledgeApi,
  type KnowledgeDocument,
} from '@/lib/api/knowledge';
import {
  sourcesApi,
  type SourceArtifact,
  type UnifiedSearchResult,
} from '@/lib/api/sources';

interface PageProps {
  params: Promise<{ organizationId: string }>;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-gray-100 text-gray-700' },
  indexing: { label: 'Indexing', className: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Indexed', className: 'bg-emerald-100 text-emerald-700' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-700' },
};

export default function BrainPage({ params }: PageProps) {
  const { organizationId } = use(params);
  const queryClient = useQueryClient();

  const [uploadForm, setUploadForm] = useState({
    title: '',
    content: '',
    artifactKind: '',
    topicTags: '',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showUpload, setShowUpload] = useState(false);

  const { data: knowledgeDocs, isLoading: docsLoading } = useQuery({
    queryKey: ['knowledge-docs', organizationId],
    queryFn: () => knowledgeApi.list(organizationId),
  });

  const { data: sources } = useQuery({
    queryKey: ['sources', organizationId],
    queryFn: () => sourcesApi.list(organizationId),
  });

  const ingestMutation = useMutation({
    mutationFn: () => {
      const tags = uploadForm.topicTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      return knowledgeApi.ingest(organizationId, {
        title: uploadForm.title,
        content: uploadForm.content,
        ...(uploadForm.artifactKind && { artifactKind: uploadForm.artifactKind }),
        ...(tags.length > 0 && { topicTags: tags }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-docs', organizationId] });
      setUploadForm({ title: '', content: '', artifactKind: '', topicTags: '' });
      setShowUpload(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => knowledgeApi.remove(organizationId, docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-docs', organizationId] });
    },
  });

  const refreshMutation = useMutation({
    mutationFn: (docId: string) => knowledgeApi.refreshStatus(organizationId, docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-docs', organizationId] });
    },
  });

  const searchMutation = useMutation({
    mutationFn: (query: string) => sourcesApi.unifiedSearch(organizationId, query, 10),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    searchMutation.mutate(searchQuery);
  };

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.title.trim() || !uploadForm.content.trim()) return;
    ingestMutation.mutate();
  };

  const totalSources = (sources?.length ?? 0);
  const totalKnowledge = (knowledgeDocs?.total ?? 0);
  const publications = sources?.filter((s: SourceArtifact) => s.kind === 'PUBLICATION').length ?? 0;
  const procedures = sources?.filter((s: SourceArtifact) => s.kind === 'SYNTHETIC_PROCEDURE').length ?? 0;

  return (
    <PageContainer>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <PageHeader
          title="Company Brain"
          description="Knowledge base — publications, procedures, and uploaded documents"
        >
          <div className="flex gap-2">
            <Button onClick={() => setShowUpload(!showUpload)}>
              <Upload className="mr-2 h-4 w-4" />
              Upload document
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/organizations/${organizationId}/reconciliation`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Reconciliation
              </Link>
            </Button>
          </div>
        </PageHeader>

        {/* Stats bar */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold">{totalSources + totalKnowledge}</p>
              <p className="text-xs text-muted-foreground">Total Sources</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold">{publications}</p>
              <p className="text-xs text-muted-foreground">Publications</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold">{procedures}</p>
              <p className="text-xs text-muted-foreground">Procedures</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold">{totalKnowledge}</p>
              <p className="text-xs text-muted-foreground">Uploaded Docs</p>
            </CardContent>
          </Card>
        </div>

        {/* Upload form */}
        {showUpload && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upload Document</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpload} className="space-y-4">
                <div>
                  <Label htmlFor="doc-title">Title</Label>
                  <Input
                    id="doc-title"
                    placeholder="e.g., QI Committee Minutes — September 2026"
                    value={uploadForm.title}
                    onChange={(e) =>
                      setUploadForm((f) => ({ ...f, title: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="doc-content">Content</Label>
                  <Textarea
                    id="doc-content"
                    placeholder="Paste document content here..."
                    className="min-h-[200px] font-mono text-sm"
                    value={uploadForm.content}
                    onChange={(e) =>
                      setUploadForm((f) => ({ ...f, content: e.target.value }))
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="doc-kind">Document kind (optional)</Label>
                    <Input
                      id="doc-kind"
                      placeholder="e.g., policy_memo, audit_finding, training_material"
                      value={uploadForm.artifactKind}
                      onChange={(e) =>
                        setUploadForm((f) => ({ ...f, artifactKind: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="doc-tags">Topic tags (optional, comma-separated)</Label>
                    <Input
                      id="doc-tags"
                      placeholder="e.g., business-day, eligibility, C-SSRS"
                      value={uploadForm.topicTags}
                      onChange={(e) =>
                        setUploadForm((f) => ({ ...f, topicTags: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={ingestMutation.isPending}>
                    {ingestMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Ingest into HydraDB
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowUpload(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Unified search */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Search All Collections</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                placeholder="Search across all knowledge..."
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

            <div className="flex flex-wrap gap-2">
              {['What triggers a C-SSRS assessment?', 'Two business day reporting window', 'PHQ-9 eligibility criteria'].map(
                (q) => (
                  <button
                    key={q}
                    type="button"
                    className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
                    onClick={() => {
                      setSearchQuery(q);
                      searchMutation.mutate(q);
                    }}
                  >
                    {q}
                  </button>
                ),
              )}
            </div>

            {searchMutation.data && (
              <div className="space-y-2">
                {searchMutation.data.results.length === 0 && (
                  <p className="text-sm text-muted-foreground">No results found.</p>
                )}
                {searchMutation.data.results.map(
                  (r: UnifiedSearchResult, idx: number) => {
                    const pct = r.score * 100;
                    const barColor =
                      pct > 70
                        ? 'bg-emerald-500'
                        : pct > 40
                          ? 'bg-amber-500'
                          : 'bg-gray-400';
                    return (
                      <div
                        key={`${r.sourceId}-${idx}`}
                        className="rounded border p-3"
                      >
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-bold">
                            {idx + 1}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {r.collection === 'knowledge' ? (
                              <BookOpen className="mr-1 h-3 w-3" />
                            ) : (
                              <FileText className="mr-1 h-3 w-3" />
                            )}
                            {r.collection}
                          </Badge>
                          <div className="ml-auto flex items-center gap-2">
                            <div className="h-1.5 w-16 rounded-full bg-muted">
                              <div
                                className={`h-1.5 rounded-full ${barColor}`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
                          {r.text}
                        </p>
                      </div>
                    );
                  },
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Connections (graph context) */}
        {searchMutation.data?.connections && searchMutation.data.connections.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Connections</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {searchMutation.data.connections.map((c, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 rounded border p-2 text-sm"
                >
                  <span className="font-medium truncate max-w-[200px]">{c.from}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span className="inline-block h-px w-8 bg-border" />
                    {c.relation}
                    <span className="inline-block h-px w-8 bg-border" />
                    →
                  </span>
                  <span className="font-medium truncate max-w-[200px]">{c.to}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Knowledge documents */}
        {docsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          knowledgeDocs &&
          knowledgeDocs.items.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Uploaded Documents ({knowledgeDocs.total})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {knowledgeDocs.items.map((doc: KnowledgeDocument) => {
                      const status = STATUS_BADGE[doc.indexingStatus] ?? STATUS_BADGE.pending;
                      return (
                        <TableRow key={doc.id}>
                          <TableCell className="text-sm">{doc.title}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-xs ${status.className}`}>
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(doc.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {doc.indexingStatus !== 'completed' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => refreshMutation.mutate(doc.id)}
                                  disabled={refreshMutation.isPending}
                                >
                                  <RefreshCw className="h-3 w-3" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteMutation.mutate(doc.id)}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )
        )}

        {/* Source artifacts */}
        {sources && sources.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Source Artifacts ({sources.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead>Indexed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sources.map((s: SourceArtifact) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-sm">{s.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {s.kind === 'PUBLICATION' ? (
                            <BookOpen className="mr-1 h-3 w-3 text-blue-600" />
                          ) : (
                            <FileText className="mr-1 h-3 w-3 text-violet-600" />
                          )}
                          {s.kind.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {s.hydraSourceId ? (
                          <Badge variant="outline" className="text-xs bg-emerald-100 text-emerald-700">
                            Indexed
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
