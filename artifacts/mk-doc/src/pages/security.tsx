import React from "react";
import { useListVulnerabilities, useGetSecuritySummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, ShieldAlert, CheckCircle, Clock } from "lucide-react";

export default function Security() {
  const { data: vulnerabilities, isLoading: vulnsLoading } = useListVulnerabilities();
  const { data: summary, isLoading: summaryLoading } = useGetSecuritySummary();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Security Center</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {summaryLoading ? (
          [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full" />)
        ) : summary ? (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Security Score</CardTitle>
                <Shield className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.securityScore}/100</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Critical/High</CardTitle>
                <ShieldAlert className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{summary.critical + summary.high}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                <Clock className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.inProgress}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Resolved</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.resolved}</div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vulnerabilities</CardTitle>
        </CardHeader>
        <CardContent>
          {vulnsLoading ? (
             <div className="space-y-4">
               {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
             </div>
          ) : vulnerabilities && vulnerabilities.length > 0 ? (
            <div className="overflow-x-auto -mx-6"><Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Application</TableHead>
                  <TableHead>CVE</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vulnerabilities.map((vuln) => (
                  <TableRow key={vuln.id}>
                    <TableCell className="font-medium">{vuln.title}</TableCell>
                    <TableCell>
                      <Badge variant={
                        vuln.severity === 'critical' ? 'destructive' :
                        vuln.severity === 'high' ? 'destructive' :
                        vuln.severity === 'medium' ? 'secondary' : 'outline'
                      }>
                        {vuln.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>{vuln.applicationName || `App #${vuln.applicationId}`}</TableCell>
                    <TableCell className="font-mono text-xs">{vuln.cveId || 'N/A'}</TableCell>
                    <TableCell>{vuln.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table></div>
          ) : (
             <p className="text-sm text-muted-foreground text-center py-8">No vulnerabilities found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}