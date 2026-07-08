import React from "react";
import { useListSoftware } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function Software() {
  const { data: software, isLoading } = useListSoftware();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Software Inventory</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Libraries & Frameworks</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
             <div className="space-y-4">
               {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
             </div>
          ) : software && software.length > 0 ? (
            <div className="overflow-x-auto -mx-6"><Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Installed Ver</TableHead>
                  <TableHead>Latest Ver</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>EOL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {software.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.type}</TableCell>
                    <TableCell className="font-mono text-xs">{item.installedVersion || 'N/A'}</TableCell>
                    <TableCell className="font-mono text-xs">{item.latestVersion || 'N/A'}</TableCell>
                    <TableCell>
                      {item.upgradeAvailable ? (
                        <Badge variant="secondary">Upgrade Available</Badge>
                      ) : (
                        <Badge variant="outline">Up to date</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.endOfLife ? (
                        <Badge variant="destructive">EOL Reached</Badge>
                      ) : item.endOfLifeDate ? (
                        <span className="text-sm text-muted-foreground">{new Date(item.endOfLifeDate).toLocaleDateString()}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Supported</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table></div>
          ) : (
             <p className="text-sm text-muted-foreground text-center py-8">No software records found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}