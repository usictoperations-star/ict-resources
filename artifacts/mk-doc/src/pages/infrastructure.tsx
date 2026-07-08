import React from "react";
import { useListInfrastructure } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export default function Infrastructure() {
  const { data: infra, isLoading } = useListInfrastructure();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Infrastructure Management</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Servers & Resources</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : infra && infra.length > 0 ? (
            <div className="overflow-x-auto -mx-6"><Table className="min-w-[500px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {infra.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.type}</TableCell>
                    <TableCell>{item.ipAddress || 'N/A'}</TableCell>
                    <TableCell>{item.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table></div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No infrastructure found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}