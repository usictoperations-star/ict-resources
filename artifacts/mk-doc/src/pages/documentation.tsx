import React from "react";
import { useListDocuments } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, ExternalLink } from "lucide-react";

export default function Documentation() {
  const { data: documents, isLoading } = useListDocuments();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Documentation Center</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Document Repository</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
             <div className="space-y-4">
               {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
             </div>
          ) : documents && documents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Application</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center">
                        <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                        {doc.url ? (
                          <a href={doc.url} target="_blank" rel="noreferrer" className="flex items-center text-primary hover:underline">
                            {doc.title} <ExternalLink className="h-3 w-3 ml-1" />
                          </a>
                        ) : doc.title}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{doc.type}</Badge>
                    </TableCell>
                    <TableCell>{doc.applicationName || 'Global'}</TableCell>
                    <TableCell>{doc.version || 'v1.0'}</TableCell>
                    <TableCell>{new Date(doc.updatedAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
             <p className="text-sm text-muted-foreground text-center py-8">No documents found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}