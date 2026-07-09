import React from "react";
import { useGetApplication, getGetApplicationQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useParams, Link } from "wouter";
import {
  ArrowLeft, AppWindow, Server, Globe, Tag, User, Building2,
  Code2, Database, Cloud, CalendarDays, ShieldCheck, Layers
} from "lucide-react";
import { TeamBadge } from "@/components/team-badge";

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
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
  testing: "bg-blue-100 text-blue-800 border-blue-200",
  staging: "bg-yellow-100 text-yellow-800 border-yellow-200",
  maintenance: "bg-orange-100 text-orange-800 border-orange-200",
  deprecated: "bg-red-100 text-red-700 border-red-200",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-green-100 text-green-700 border-green-200",
};

export default function ApplicationDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id || "0", 10);
  const { data: app, isLoading } = useGetApplication(id, { query: { enabled: !!id, queryKey: getGetApplicationQueryKey(id) } });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!app) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <AppWindow className="h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium">Application not found</p>
        <Link href="/applications">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Registry
          </Button>
        </Link>
      </div>
    );
  }

  const statusKey = (app.status ?? "").toLowerCase();
  const priorityKey = (app.priority ?? "").toLowerCase();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href="/applications">
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            Application Registry
          </button>
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{app.name}</h1>
            {app.shortName && (
              <p className="text-sm text-muted-foreground mt-0.5 font-mono">{app.shortName}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {app.priority && (
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${PRIORITY_COLORS[priorityKey] ?? "bg-muted text-muted-foreground"}`}>
                {app.priority} priority
              </span>
            )}
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_COLORS[statusKey] ?? "bg-muted text-muted-foreground"}`}>
              {app.status}
            </span>
          </div>
        </div>
        {app.description && (
          <p className="mt-3 text-sm text-muted-foreground max-w-2xl leading-relaxed">
            {app.description}
          </p>
        )}
      </div>

      {/* Classification */}
      <Section title="Classification" icon={Layers}>
        <Field label="Category" value={app.category} />
        <Field label="Classification" value={app.classification} />
        <Field label="Environment" value={app.environment} />
        <Field label="Status" value={app.status} />
        <Field label="Priority" value={app.priority} />
        <Field label="Criticality" value={app.criticality} />
      </Section>

      {/* Ownership */}
      <Section title="Ownership" icon={Building2}>
        <Field label="Ministry" value={app.ministry} />
        <Field label="Department" value={app.department} />
        <Field label="Business Owner" value={app.businessOwner} />
        <Field label="Technical Owner" value={app.technicalOwner} />
        <Field label="Product Owner" value={app.productOwner} />
        <Field label="Support Contact" value={app.supportContact} />
        <div>
          <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Team</dt>
          <dd><TeamBadge teamId={app.teamId} /></dd>
        </div>
      </Section>

      {/* Technology Stack */}
      <Section title="Technology Stack" icon={Code2}>
        <Field label="Frontend" value={app.frontend} />
        <Field label="Backend" value={app.backend} />
        <Field label="Framework" value={app.framework} />
        <Field label="Language" value={app.language} />
        <Field label="Database" value={app.database} />
        <Field label="Hosting Provider" value={app.hostingProvider} />
      </Section>

      {/* Deployment */}
      <Section title="Deployment" icon={Globe}>
        <Field label="Domain" value={app.domain} />
        <Field label="Current Version" value={app.currentVersion} />
        <Field label="Launch Date" value={app.launchDate} />
      </Section>

      {/* Tags */}
      {app.tags && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Tag className="h-4 w-4 text-muted-foreground" />
              Tags
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {app.tags.split(",").map(tag => tag.trim()).filter(Boolean).map(tag => (
                <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground border font-medium">
                  {tag}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
