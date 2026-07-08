import React from "react";
import { useListUsers, useListAuditLogs } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Admin() {
  const { data: users, isLoading: usersLoading } = useListUsers();
  const { data: auditLogs, isLoading: logsLoading } = useListAuditLogs({ limit: 50 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Administration</h1>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList>
          <TabsTrigger value="users">Users & Roles</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
        </TabsList>
        
        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>Manage user access and roles across MK DOC.</CardDescription>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                 <div className="space-y-4">
                   {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                 </div>
              ) : users && users.length > 0 ? (
                <div className="overflow-x-auto -mx-6"><Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Login</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{user.role}</Badge>
                        </TableCell>
                        <TableCell>{user.department || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>{user.status}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table></div>
              ) : (
                 <p className="text-sm text-muted-foreground text-center py-8">No users found.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>System Audit Logs</CardTitle>
              <CardDescription>Recent activity across all MK DOC modules.</CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                 <div className="space-y-4">
                   {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                 </div>
              ) : auditLogs && auditLogs.length > 0 ? (
                <div className="overflow-x-auto -mx-6"><Table className="min-w-[600px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Entity Type</TableHead>
                        <TableHead>Entity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((log) => (
                        <TableRow key={log.id} className="text-sm">
                          <TableCell className="text-muted-foreground whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString()}
                          </TableCell>
                          <TableCell className="font-medium">{log.userName || `User #${log.userId}`}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="uppercase text-[10px]">{log.action}</Badge>
                          </TableCell>
                          <TableCell className="capitalize">{log.entityType}</TableCell>
                          <TableCell className="font-mono text-xs truncate max-w-[200px]">{log.entityName || `ID: ${log.entityId}`}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table></div>
              ) : (
                 <p className="text-sm text-muted-foreground text-center py-8">No audit logs found.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}