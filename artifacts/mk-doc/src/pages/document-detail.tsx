import React from "react";
import { useGetDocument, getGetDocumentQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useParams, Link } from "wouter";
import { ArrowLeft, FileText, Tag, User, Settings, ExternalLink } from "lucide-react";

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{String(value)}</dd>
    </div>
  );
}

function Section({
  title, icon: Icon, children
}: {
  title: string; icon: React.ElementType; children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          {children}
        </dl>
      </CardContent>
    </Card>
  );
}

const TYPE_COLORS: Record<string, string> = {
  prd: "bg-blue-100 text-blue-800 border-blue-200",
  trd: "bg-purple-100 text-purple-800 border-purple-200",
  sop: "bg-green-100 text-green-800 border-green-200",
  erd: "bg-orange-100 text-orange-800 border-orange-200",
  other: "bg-gray-100 text-gray-700 border-gray-200",
};

export default function DocumentDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id || "0", 10);
  const { data: doc, isLoading } = useGetDocument(id, {
    query: { enabled: !!id, queryKey: getGetDocumentQueryKey(id) },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <FileText className="h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium">Document not found</p>
        <Link href="/documentation">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Documentation
          </Button>
        </Link>
      </div>
    );
  }

  const typeKey = (doc.type ?? "").toLowerCase();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/documentation">
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            Documentation
          </button>
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{doc.title}</h1>
            {doc.applicationName && (
              <p className="text-sm text-muted-foreground mt-0.5">{doc.applicationName}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${TYPE_COLORS[typeKey] ?? "bg-muted text-muted-foreground"}`}>
              {doc.type.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      <Section title="Document Details" icon={FileText}>
        <Field label="Type" value={doc.type} />
        <Field label="Version" value={doc.version} />
        <Field label="Author" value={doc.author} />
        <Field label="Application" value={doc.applicationName} />
      </Section>

      {doc.url && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
              Link
            </CardTitle>
          </CardHeader>
          <CardContent>
            <a
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline break-all"
            >
              {doc.url}
            </a>
          </CardContent>
        </Card>
      )}

      {doc.tags && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Tag className="h-4 w-4 text-muted-foreground" />
              Tags
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {doc.tags.split(",").map(tag => tag.trim()).filter(Boolean).map(tag => (
                <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground border font-medium">
                  {tag}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {doc.content && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Content
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{doc.content}</p>
          </CardContent>
        </Card>
      )}

      <Section title="Metadata" icon={Settings}>
        <Field label="Created" value={doc.createdAt} />
        <Field label="Updated" value={doc.updatedAt} />
      </Section>
    </div>
  );
}
