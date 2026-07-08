import React from "react";
import { useListDatabases } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export default function Databases() {
  const { data: databases, isLoading } = useListDatabases();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Database Management</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Databases</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : databases && databases.length > 0 ? (
            <div className="overflow-x-auto -mx-6"><Table className="min-w-[500px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Server</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {databases.map((db) => (
                  <TableRow key={db.id}>
                    <TableCell className="font-medium">{db.name}</TableCell>
                    <TableCell>{db.type}</TableCell>
                    <TableCell>{db.server || 'N/A'}</TableCell>
                    <TableCell>{db.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table></div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No databases found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}