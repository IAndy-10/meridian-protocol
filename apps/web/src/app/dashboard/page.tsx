'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Activity, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/PageHeader';
import { organizationsApi } from '@/lib/organizations-api';

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['user-organizations'],
    queryFn: () => organizationsApi.getUserOrganizations(),
  });

  return (
    <>
      <PageHeader
        title="Meridian Protocol"
        description="Screening-to-assessment reconciliation demonstrator."
      />

      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && data?.organizations.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          No organizations available. Contact your administrator.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {data?.organizations.map((organization) => (
          <Link key={organization.id} href={`/organizations/${organization.id}/reconciliation`}>
            <Card className="h-full transition-colors hover:border-primary">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Activity className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{organization.name}</CardTitle>
                  </div>
                  <Badge variant="secondary">{organization.role.toLowerCase()}</Badge>
                </div>
                <CardDescription>Open reconciliation dashboard</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
