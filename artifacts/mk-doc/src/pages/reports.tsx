import React from "react";
import { useGetInventoryReport, useGetSecurityReport, useGetRenewalReport } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export default function Reports() {
  const { data: inventory, isLoading: invLoading } = useGetInventoryReport();
  const { data: security, isLoading: secLoading } = useGetSecurityReport();
  const { data: renewals, isLoading: renLoading } = useGetRenewalReport();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Reports & Analytics</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Inventory Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {invLoading ? (
               <Skeleton className="h-[300px] w-full" />
            ) : inventory ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">Applications</span>
                    <span className="text-2xl font-bold">{inventory.totalApplications}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">Servers</span>
                    <span className="text-2xl font-bold">{inventory.totalServers}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">Databases</span>
                    <span className="text-2xl font-bold">{inventory.totalDatabases}</span>
                  </div>
                </div>
                
                <div className="h-[200px] w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={inventory.applicationsByCategory}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="category" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{fill: 'hsl(var(--muted))'}} contentStyle={{backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '6px'}} />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security Posture</CardTitle>
          </CardHeader>
          <CardContent>
            {secLoading ? (
               <Skeleton className="h-[300px] w-full" />
            ) : security ? (
              <div className="space-y-6">
                 <div className="flex items-center justify-between border-b pb-4">
                   <div className="flex flex-col">
                     <span className="text-sm text-muted-foreground">Overall Score</span>
                     <span className="text-3xl font-bold text-primary">{security.overallScore}</span>
                   </div>
                   <div className="flex flex-col items-end">
                     <span className="text-sm text-muted-foreground">Resolved (30d)</span>
                     <span className="text-3xl font-bold text-green-500">{security.resolvedLast30Days}</span>
                   </div>
                 </div>
                 
                 <div>
                   <h4 className="text-sm font-medium mb-3">Top Affected Applications</h4>
                   <div className="space-y-3">
                     {security.topAffectedApplications.map((app, i) => (
                       <div key={i} className="flex items-center justify-between">
                         <span className="text-sm">{app.applicationName}</span>
                         <span className="text-sm font-medium px-2 py-1 bg-destructive/10 text-destructive rounded">{app.count} issues</span>
                       </div>
                     ))}
                   </div>
                 </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
        
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Upcoming Renewals</CardTitle>
          </CardHeader>
          <CardContent>
            {renLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : renewals && renewals.length > 0 ? (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {renewals.map(item => (
                   <div key={item.id} className="p-4 border rounded-lg flex flex-col gap-2">
                     <div className="flex justify-between items-start">
                       <span className="font-medium truncate pr-2" title={item.name}>{item.name}</span>
                       <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                         item.daysUntilExpiry < 30 ? 'bg-destructive/10 text-destructive' : 'bg-yellow-500/10 text-yellow-600'
                       }`}>
                         {item.daysUntilExpiry} days
                       </span>
                     </div>
                     <div className="text-xs text-muted-foreground flex justify-between">
                       <span className="capitalize">{item.type}</span>
                       <span>{new Date(item.expiryDate).toLocaleDateString()}</span>
                     </div>
                   </div>
                 ))}
               </div>
            ) : (
              <p className="text-sm text-muted-foreground">No upcoming renewals found.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}