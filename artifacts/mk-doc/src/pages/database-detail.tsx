import React from "react";
import { useGetDatabaseRecord, getGetDatabaseRecordQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useParams, Link } from "wouter";
import { ArrowLeft, Database, Server, Shield, Settings } from "lucide-react";
import { OwnerBadge } from "@/components/owner-badge";
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
  maintenance: "bg-orange-100 text-orange-800 border-orange-200",
  deprecated: "bg-red-100 text-red-700 border-red-200",
};

const BACKUP_COLORS: Record<string, string> = {
  success: "bg-green-100 text-green-800 border-green-200",
  failed: "bg-red-100 text-red-800 border-red-200",
  running: "bg-blue-100 text-blue-800 border-blue-200",
  none: "bg-gray-100 text-gray-700 border-gray-200",
};

export default function DatabaseDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id || "0", 10);
  const { data: db, isLoading } = useGetDatabaseRecord(id, {
    query: { enabled: !!id, queryKey: getGetDatabaseRecordQueryKey(id) },
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

  if (!db) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Database className="h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium">Database not found</p>
        <Link href="/databases">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Databases
          </Button>
        </Link>
      </div>
    );
  }

  const statusKey = (db.status ?? "").toLowerCase();
  const backupKey = (db.lastBackupStatus ?? "").toLowerCase();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/databases">
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            Databases
          </button>
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{db.name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{db.type}{db.version ? ` v${db.version}` : ""}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${BACKUP_COLORS[backupKey] ?? "bg-muted text-muted-foreground"}`}>
              Backup: {db.lastBackupStatus}
            </span>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_COLORS[statusKey] ?? "bg-muted text-muted-foreground"}`}>
              {db.status}
            </span>
          </div>
        </div>
      </div>

      <Section title="Database Details" icon={Database}>
        <Field label="Type" value={db.type} />
        <Field label="Version" value={db.version} />
        <Field label="Status" value={db.status} />
        <Field label="Server" value={db.server} />
        <Field label="Owner" value={db.owner} />
        <Field label="Size (GB)" value={db.sizeGb} />
      </Section>

      <Section title="Security & Backups" icon={Shield}>
        <Field label="Backup Enabled" value={db.backupEnabled} />
        <Field label="Encryption Enabled" value={db.encryptionEnabled} />
        <Field label="Last Backup" value={db.lastBackupAt} />
        <Field label="Last Backup Status" value={db.lastBackupStatus} />
      </Section>

      <Section title="Metadata" icon={Settings}>
        <Field label="Created" value={db.createdAt} />
        <Field label="Updated" value={db.updatedAt} />
        <div>
          <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Owner</dt>
          <dd><OwnerBadge ownerName={db.ownerName} /></dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Team</dt>
          <dd><TeamBadge teamId={db.teamId} /></dd>
        </div>
      </Section>

      {db.notes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="h-4 w-4 text-muted-foreground" />
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{db.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
