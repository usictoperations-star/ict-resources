import React from "react";
import { useGetInfrastructure, getGetInfrastructureQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useParams, Link } from "wouter";
import { ArrowLeft, Server, Cpu, HardDrive, MapPin, Network, Settings } from "lucide-react";
import { OwnerBadge } from "@/components/owner-badge";
import { TeamBadge } from "@/components/team-badge";

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

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800 border-green-200",
  inactive: "bg-gray-100 text-gray-700 border-gray-200",
  maintenance: "bg-orange-100 text-orange-800 border-orange-200",
  decommissioned: "bg-red-100 text-red-700 border-red-200",
};

const PATCH_COLORS: Record<string, string> = {
  up_to_date: "bg-green-100 text-green-800 border-green-200",
  needs_patching: "bg-red-100 text-red-800 border-red-200",
  scheduled: "bg-yellow-100 text-yellow-700 border-yellow-200",
};

export default function InfrastructureDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id || "0", 10);
  const { data: item, isLoading } = useGetInfrastructure(id, {
    query: { enabled: !!id, queryKey: getGetInfrastructureQueryKey(id) },
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

  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Server className="h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium">Infrastructure item not found</p>
        <Link href="/infrastructure">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Infrastructure
          </Button>
        </Link>
      </div>
    );
  }

  const statusKey = (item.status ?? "").toLowerCase();
  const patchKey = (item.patchStatus ?? "").toLowerCase();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/infrastructure">
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            Infrastructure
          </button>
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{item.name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{item.type}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {item.patchStatus && (
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${PATCH_COLORS[patchKey] ?? "bg-muted text-muted-foreground"}`}>
                {item.patchStatus.replace(/_/g, " ")}
              </span>
            )}
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_COLORS[statusKey] ?? "bg-muted text-muted-foreground"}`}>
              {item.status}
            </span>
          </div>
        </div>
      </div>

      <Section title="System Details" icon={Server}>
        <Field label="Type" value={item.type} />
        <Field label="Provider" value={item.provider} />
        <Field label="Status" value={item.status} />
        <Field label="Operating System" value={item.os} />
        <Field label="Patch Status" value={item.patchStatus?.replace(/_/g, " ")} />
        <Field label="Last Patched" value={item.lastPatchedAt} />
      </Section>

      <Section title="Network & Location" icon={Network}>
        <Field label="IP Address" value={item.ipAddress} />
        <Field label="Location" value={item.location} />
      </Section>

      <Section title="Hardware" icon={Cpu}>
        <Field label="CPU Cores" value={item.cpuCores} />
        <Field label="RAM (GB)" value={item.ramGb} />
        <Field label="Disk (GB)" value={item.diskGb} />
      </Section>

      <Section title="Metadata" icon={Settings}>
        <Field label="Created" value={item.createdAt} />
        <Field label="Updated" value={item.updatedAt} />
        <div>
          <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Owner</dt>
          <dd><OwnerBadge ownerName={item.ownerName} /></dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Team</dt>
          <dd><TeamBadge teamId={item.teamId} /></dd>
        </div>
      </Section>

      {item.notes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="h-4 w-4 text-muted-foreground" />
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
