import React from "react";
import { useListReleases } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function Releases() {
  const { data: releases, isLoading } = useListReleases();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Release Management</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Releases</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
             <div className="space-y-4">
               {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
             </div>
          ) : releases && releases.length > 0 ? (
            <div className="overflow-x-auto -mx-6"><Table className="min-w-[650px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Application</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Environment</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Approved</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {releases.map((release) => (
                  <TableRow key={release.id}>
                    <TableCell className="font-medium">{release.applicationName || `App #${release.applicationId}`}</TableCell>
                    <TableCell className="font-mono text-xs">{release.version}</TableCell>
                    <TableCell>{release.environment}</TableCell>
                    <TableCell>{release.releaseDate ? new Date(release.releaseDate).toLocaleString() : 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant={release.status === 'successful' ? 'default' : release.status === 'failed' ? 'destructive' : 'secondary'}>
                        {release.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {release.approved ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-200 dark:border-green-900 dark:text-green-400">Yes</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 border-yellow-200 dark:border-yellow-900 dark:text-yellow-400">Pending</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table></div>
          ) : (
             <p className="text-sm text-muted-foreground text-center py-8">No releases found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}