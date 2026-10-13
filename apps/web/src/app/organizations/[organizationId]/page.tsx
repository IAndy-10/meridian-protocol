'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Activity, FileText, Brain, Loader2, Settings } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { organizationsApi } from '@/lib/organizations-api';

interface PageProps {
  params: Promise<{ organizationId: string }>;
}

export default function OrganizationPage({ params }: PageProps) {
  const { organizationId } = use(params);

  const { data: organization, isLoading } = useQuery({
    queryKey: ['organization', organizationId],
    queryFn: () => organizationsApi.getOrganization(organizationId),
  });

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageContainer>
    );
  }

  if (!organization) {
    return (
      <PageContainer>
        <div className="mx-auto max-w-4xl px-4 py-16 text-center text-muted-foreground">
          Organization not found.
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
        <PageHeader title={organization.name} description="Meridian Protocol — Screening-to-Assessment Reconciliation">
          <Button variant="outline" asChild>
            <Link href={`/organizations/${organizationId}/settings`}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </Button>
        </PageHeader>

        <div className="grid gap-4 sm:grid-cols-3">
          <Link href={`/organizations/${organizationId}/reconciliation`}>
            <Card className="h-full transition-colors hover:border-primary cursor-pointer">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Activity className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">Reconciliation</CardTitle>
                </div>
                <CardDescription>
                  Run reconciliation, view counts, inspect linkage decisions, and review exceptions.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href={`/organizations/${organizationId}/brain`}>
            <Card className="h-full transition-colors hover:border-primary cursor-pointer">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Brain className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">Company Brain</CardTitle>
                </div>
                <CardDescription>
                  Upload documents, search across all knowledge, and explore source connections.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href={`/organizations/${organizationId}/reconciliation/sources`}>
            <Card className="h-full transition-colors hover:border-primary cursor-pointer">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">Sources</CardTitle>
                </div>
                <CardDescription>
                  Search and inspect source artifacts — publications and synthetic procedures.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          SYNTHETIC — NOT AN APPROVED CLINICAL PROCEDURE. All data is synthetic.
        </p>
      </div>
    </PageContainer>
  );
}
