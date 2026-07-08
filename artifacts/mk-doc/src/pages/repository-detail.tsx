import React from "react";
import { useGetRepository, getGetRepositoryQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useParams, Link } from "wouter";
import { ArrowLeft, GitBranch, GitPullRequest, AlertCircle, Shield, Settings } from "lucide-react";
import { TeamBadge } from "@/components/team-badge";

function Field({ label, value }: { label: string; value?: string | number | boolean | null }) {
  if (value === null || value === undefined || value === "") return null;
  const display = typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{display}</dd>
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

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800 border-green-200",
  inactive: "bg-gray-100 text-gray-700 border-gray-200",
  archived: "bg-gray-100 text-gray-700 border-gray-200",
  deprecated: "bg-red-100 text-red-700 border-red-200",
};

const VISIBILITY_COLORS: Record<string, string> = {
  public: "bg-blue-100 text-blue-800 border-blue-200",
  private: "bg-gray-100 text-gray-700 border-gray-200",
  internal: "bg-purple-100 text-purple-800 border-purple-200",
};

export default function RepositoryDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id || "0", 10);
  const { data: repo, isLoading } = useGetRepository(id, {
    query: { enabled: !!id, queryKey: getGetRepositoryQueryKey(id) },
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

  if (!repo) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <GitBranch className="h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium">Repository not found</p>
        <Link href="/repositories">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Repositories
          </Button>
        </Link>
      </div>
    );
  }

  const statusKey = (repo.status ?? "").toLowerCase();
  const visibilityKey = (repo.visibility ?? "").toLowerCase();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/repositories">
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            Repositories
          </button>
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{repo.name}</h1>
            {repo.url && (
              <a
                href={repo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline mt-0.5 inline-block"
              >
                {repo.url}
              </a>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {repo.secretsExposed && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full border bg-red-100 text-red-800 border-red-200">
                Secrets Exposed
              </span>
            )}
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${VISIBILITY_COLORS[visibilityKey] ?? "bg-muted text-muted-foreground"}`}>
              {repo.visibility}
            </span>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_COLORS[statusKey] ?? "bg-muted text-muted-foreground"}`}>
              {repo.status}
            </span>
          </div>
        </div>
      </div>

      <Section title="Repository Details" icon={GitBranch}>
        <Field label="Default Branch" value={repo.defaultBranch} />
        <Field label="Language" value={repo.language} />
        <Field label="Visibility" value={repo.visibility} />
        <Field label="Status" value={repo.status} />
        <Field label="Last Commit" value={repo.lastCommitAt} />
      </Section>

      <Section title="Activity" icon={GitPullRequest}>
        <Field label="Open Pull Requests" value={repo.openPullRequests} />
        <Field label="Open Issues" value={repo.openIssues} />
      </Section>

      <Section title="Security" icon={Shield}>
        <Field label="Secrets Exposed" value={repo.secretsExposed} />
        <Field label="Last Scanned" value={repo.lastScannedAt} />
      </Section>

      <Section title="Metadata" icon={Settings}>
        <Field label="Created" value={repo.createdAt} />
        <Field label="Updated" value={repo.updatedAt} />
        <div>
          <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Team</dt>
          <dd><TeamBadge teamId={repo.teamId} /></dd>
        </div>
      </Section>

      {repo.notes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="h-4 w-4 text-muted-foreground" />
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{repo.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
