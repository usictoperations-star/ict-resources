import React from "react";
import { useListRepositories } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GitPullRequest, CircleDot } from "lucide-react";

export default function Repositories() {
  const { data: repositories, isLoading } = useListRepositories();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Repository Management</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Source Code Repositories</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
             <div className="space-y-4">
               {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
             </div>
          ) : repositories && repositories.length > 0 ? (
            <div className="overflow-x-auto -mx-6"><Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead>PRs</TableHead>
                  <TableHead>Issues</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {repositories.map((repo) => (
                  <TableRow key={repo.id}>
                    <TableCell className="font-medium">
                      {repo.url ? (
                        <a href={repo.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                          {repo.name}
                        </a>
                      ) : repo.name}
                    </TableCell>
                    <TableCell>
                      {repo.language ? <Badge variant="outline">{repo.language}</Badge> : 'N/A'}
                    </TableCell>
                    <TableCell className="capitalize">{repo.visibility}</TableCell>
                    <TableCell>
                      <div className="flex items-center text-muted-foreground">
                        <GitPullRequest className="w-4 h-4 mr-1" />
                        {repo.openPullRequests}
                      </div>
                    </TableCell>
                    <TableCell>
                       <div className="flex items-center text-muted-foreground">
                        <CircleDot className="w-4 h-4 mr-1" />
                        {repo.openIssues}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={repo.status === 'active' ? 'default' : 'secondary'}>{repo.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table></div>
          ) : (
             <p className="text-sm text-muted-foreground text-center py-8">No repositories found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}