import React from "react";
import { useGetApplication } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useParams } from "wouter";

export default function ApplicationDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id || "0", 10);
  const { data: app, isLoading } = useGetApplication(id, { query: { enabled: !!id } });

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-32 w-full" /></div>;
  }

  if (!app) {
    return <div>Application not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{app.name}</h1>
        <Badge>{app.status}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground font-medium">Category</dt>
              <dd>{app.category}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground font-medium">Environment</dt>
              <dd>{app.environment}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground font-medium">Description</dt>
              <dd>{app.description || "N/A"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}