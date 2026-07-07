import React from "react";
import { useListDomains, useGetExpiringDomains } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";

export default function Domains() {
  const { data: domains, isLoading: domainsLoading } = useListDomains();
  const { data: expiringDomains, isLoading: expiringLoading } = useGetExpiringDomains();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Domain & SSL Management</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1 border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center text-destructive">
              <AlertCircle className="w-5 h-5 mr-2" />
              Expiring Soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expiringLoading ? (
              <div className="space-y-2">
                {[1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : expiringDomains && expiringDomains.length > 0 ? (
              <div className="space-y-4">
                {expiringDomains.map(domain => (
                  <div key={domain.id} className="flex flex-col gap-1 text-sm border-b pb-2 last:border-0">
                    <div className="font-semibold">{domain.name}</div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>{domain.sslExpiry ? `SSL expires: ${new Date(domain.sslExpiry).toLocaleDateString()}` : 'No SSL info'}</span>
                      <Badge variant="destructive" className="text-[10px] h-4">Action Needed</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No domains expiring soon.</p>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>All Domains</CardTitle>
          </CardHeader>
          <CardContent>
            {domainsLoading ? (
               <div className="space-y-4">
                 {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
               </div>
            ) : domains && domains.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Registrar</TableHead>
                    <TableHead>Reg. Expiry</TableHead>
                    <TableHead>SSL Status</TableHead>
                    <TableHead>Cloudflare</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {domains.map((domain) => (
                    <TableRow key={domain.id}>
                      <TableCell className="font-medium">{domain.name}</TableCell>
                      <TableCell>{domain.registrar || 'N/A'}</TableCell>
                      <TableCell>{domain.registrationExpiry ? new Date(domain.registrationExpiry).toLocaleDateString() : 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant={domain.sslStatus === 'valid' ? 'default' : 'destructive'}>
                          {domain.sslStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>{domain.cloudflarEnabled ? 'Yes' : 'No'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No domains found.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}