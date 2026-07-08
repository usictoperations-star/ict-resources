import React, { useMemo, useState } from "react";
import { z } from "zod";
import {
  useListVulnerabilities, useGetSecuritySummary, useGetSecurityDashboard,
  useCreateVulnerability, useUpdateVulnerability, useDeleteVulnerability,
} from "@workspace/api-client-react";
import { CreateVulnerabilityBody } from "@workspace/api-zod";
import { numericStringField, getFieldErrors } from "@/lib/form-validation";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import { TeamBadge } from "@/components/team-badge";
import { TeamSelectField } from "@/components/team-select-field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Shield, ShieldAlert, CheckCircle, Clock, Plus, Loader2, Pencil, Trash2,
  ServerCog, KeyRound, LockKeyholeOpen, Globe2, DatabaseBackup, UserCog,
  PackageX, ScanEye, Layers, ChevronDown, Activity, PenLine, AlertTriangle, Table2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { TablePagination } from "@/components/table-pagination";
import { usePagination } from "@/hooks/use-pagination";

const SEVERITY_OPTIONS = ["critical", "high", "medium", "low", "info"];
const STATUS_OPTIONS = ["open", "in_progress", "resolved", "accepted", "false_positive"];
const CATEGORY_OPTIONS = ["productivity", "security", "development", "database", "infrastructure", "communication", "analytics", "other"];

const vulnFormSchema = CreateVulnerabilityBody.extend({
  severity: CreateVulnerabilityBody.shape.severity.min(1, "Severity is required"),
  status: CreateVulnerabilityBody.shape.status.min(1, "Status is required"),
  applicationId: numericStringField(z.coerce.number({ invalid_type_error: "Must be a valid ID" }).int("Must be a valid ID").positive("Must be a valid ID")),
  teamId: numericStringField(z.coerce.number({ invalid_type_error: "Must be a valid team" }).int().positive()),
});

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function SelectField({ value, onValueChange, placeholder, options }: { value: string; onValueChange: (v: string) => void; placeholder: string; options: string[] }) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>{options.map(o => <SelectItem key={o} value={o} className="capitalize">{o.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
    </Select>
  );
}

const EMPTY_FORM = { title: "", description: "", severity: "medium", status: "open", applicationId: "", cveId: "", affectedComponent: "", version: "", vendor: "", category: "", installationDate: "", licenseType: "", licenseExpiration: "", endOfLifeDate: "", discoveredAt: "", assignedTo: "", notes: "", teamId: "" };

type VulnRow = {
  id: number; title: string; description?: string | null; severity: string; status: string;
  applicationId?: number | null; applicationName?: string | null; cveId?: string | null;
  affectedComponent?: string | null; version?: string | null; vendor?: string | null;
  category?: string | null; installationDate?: string | null; licenseType?: string | null;
  licenseExpiration?: string | null; endOfLifeDate?: string | null; discoveredAt?: string | null;
  assignedTo?: string | null; notes?: string | null; teamId?: number | null;
};

const TONE_TEXT: Record<string, string> = { danger: "text-destructive", warning: "text-amber-600", ok: "text-emerald-600", default: "text-foreground" };
const TONE_BADGE: Record<string, "destructive" | "secondary" | "outline"> = { danger: "destructive", warning: "secondary", ok: "outline", default: "outline" };
const TONE_BG: Record<string, string> = { danger: "bg-red-50 dark:bg-red-950/30", warning: "bg-amber-50 dark:bg-amber-950/30", ok: "bg-emerald-50 dark:bg-emerald-950/20", default: "bg-muted/30" };
const TONE_ICON_COLOR: Record<string, string> = { danger: "text-red-500", warning: "text-amber-500", ok: "text-emerald-500", default: "text-muted-foreground" };

function toneOf(count: number, dangerIfAny: "danger" | "warning" = "warning") {
  return count > 0 ? dangerIfAny : "ok";
}

function DrillDownList({ items, emptyLabel, render }: { items: unknown[]; emptyLabel: string; render: (item: any, i: number) => React.ReactNode }) {
  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <CheckCircle className="h-8 w-8 text-emerald-400 mb-2" />
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      </div>
    );
  }
  return <ul className="divide-y divide-border/60">{items.map((item, i) => <li key={i} className="py-2.5 first:pt-0 last:pb-0">{render(item, i)}</li>)}</ul>;
}

function daysRemainingBadge(days?: number | null) {
  if (days == null) return null;
  const overdue = days < 0;
  const urgent = !overdue && days <= 7;
  return (
    <Badge variant={overdue || urgent ? "destructive" : "secondary"} className="font-mono text-[10px]">
      {overdue ? `${Math.abs(days)}d overdue` : `${days}d left`}
    </Badge>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={96} height={96} viewBox="0 0 96 96" className="-rotate-90">
        <circle cx={48} cy={48} r={r} fill="none" strokeWidth={8} className="stroke-muted/40" />
        <circle
          cx={48} cy={48} r={r} fill="none" strokeWidth={8}
          stroke={color} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold leading-none" style={{ color }}>{score}</span>
        <span className="text-[9px] text-muted-foreground mt-0.5 leading-none">/ 100</span>
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon, label, value, tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: number; tone?: string;
}) {
  return (
    <div className={`flex flex-col gap-2 p-3 rounded-lg ${TONE_BG[tone]}`}>
      <div className="flex items-center justify-between">
        <Icon className={`h-3.5 w-3.5 ${TONE_ICON_COLOR[tone]}`} />
        <span className={`text-xl font-bold leading-none ${TONE_TEXT[tone]}`}>{value}</span>
      </div>
      <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
    </div>
  );
}

function Section({
  id, title, icon: Icon, badge, badgeVariant = "outline", defaultOpen = false, alert = false, children,
}: {
  id: string; title: string; icon: React.ComponentType<{ className?: string }>;
  badge?: React.ReactNode; badgeVariant?: "destructive" | "secondary" | "outline";
  defaultOpen?: boolean; alert?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div id={id} className={`rounded-xl border bg-card scroll-mt-4 overflow-hidden transition-shadow hover:shadow-sm ${alert ? "border-destructive/30" : ""}`}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        aria-expanded={open}
      >
        <div className={`h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0 ${alert ? "bg-destructive/10" : "bg-muted"}`}>
          <Icon className={`h-3.5 w-3.5 ${alert ? "text-destructive" : "text-muted-foreground"}`} />
        </div>
        <span className="font-medium text-sm flex-1 min-w-0">{title}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {badge !== undefined && (
            <Badge variant={badgeVariant} className="text-[10px] h-5 px-1.5 font-medium">{badge}</Badge>
          )}
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      <div
        className="grid transition-all duration-200 ease-in-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-1 border-t border-border/50">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Security() {
  const { data: vulnerabilities, isLoading: vulnsLoading } = useListVulnerabilities();
  const { data: summary, isLoading: summaryLoading } = useGetSecuritySummary();
  const { data: dashboard, isLoading: dashboardLoading } = useGetSecurityDashboard();
  const { mutateAsync: createVulnerability, isPending: isCreating } = useCreateVulnerability();
  const { mutateAsync: updateVulnerability, isPending: isUpdating } = useUpdateVulnerability();
  const { mutateAsync: deleteVulnerability, isPending: isDeleting } = useDeleteVulnerability();
  const queryClient = useQueryClient();

  const [editTarget, setEditTarget] = useState<VulnRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VulnRow | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [logSectionOpen, setLogSectionOpen] = useState(false);

  const isPending = isCreating || isUpdating;
  const { page, setPage, totalPages, pageItems: pagedVulnerabilities, startIndex, endIndex, total } = usePagination(vulnerabilities, 10);
  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [field]: e.target.value }));

  const scrollToLog = () => setTimeout(() => document.getElementById("log-vulnerability")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);

  const resetCreate = () => {
    setEditTarget(null); setForm({ ...EMPTY_FORM }); setErrors({});
    setLogSectionOpen(true); scrollToLog();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteVulnerability({ id: deleteTarget.id });
      await queryClient.invalidateQueries({ queryKey: ["/api/security/vulnerabilities"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/security/summary"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/security/dashboard"] });
      setDeleteTarget(null);
    } catch { }
  };

  const openEdit = (v: VulnRow) => {
    setEditTarget(v);
    setForm({
      title: v.title ?? "", description: v.description ?? "",
      severity: v.severity ?? "medium", status: v.status ?? "open",
      applicationId: v.applicationId?.toString() ?? "", cveId: v.cveId ?? "",
      affectedComponent: v.affectedComponent ?? "",
      version: v.version ?? "", vendor: v.vendor ?? "", category: v.category ?? "",
      installationDate: v.installationDate ? v.installationDate.substring(0, 10) : "",
      licenseType: v.licenseType ?? "",
      licenseExpiration: v.licenseExpiration ? v.licenseExpiration.substring(0, 10) : "",
      endOfLifeDate: v.endOfLifeDate ? v.endOfLifeDate.substring(0, 10) : "",
      discoveredAt: v.discoveredAt ? v.discoveredAt.substring(0, 10) : "",
      assignedTo: v.assignedTo ?? "", notes: v.notes ?? "",
      teamId: v.teamId?.toString() ?? "",
    });
    setErrors({});
    setLogSectionOpen(true);
    scrollToLog();
  };

  const handleSubmit = async () => {
    const result = getFieldErrors(vulnFormSchema, form);
    if ("errors" in result) { setErrors(result.errors); return; }
    setErrors({});
    const parsed = result.data;
    const payload = {
      ...parsed,
      description: parsed.description || undefined,
      cveId: parsed.cveId || undefined,
      affectedComponent: parsed.affectedComponent || undefined,
      version: form.version || undefined, vendor: form.vendor || undefined,
      category: form.category || undefined, installationDate: form.installationDate || undefined,
      licenseType: form.licenseType || undefined, licenseExpiration: form.licenseExpiration || undefined,
      endOfLifeDate: form.endOfLifeDate || undefined, discoveredAt: parsed.discoveredAt || undefined,
      assignedTo: parsed.assignedTo || undefined, notes: parsed.notes || undefined,
      teamId: form.teamId ? Number(form.teamId) : undefined,
    };
    try {
      if (editTarget) { await updateVulnerability({ id: editTarget.id, data: payload }); }
      else { await createVulnerability({ data: payload }); }
      await queryClient.invalidateQueries({ queryKey: ["/api/security/vulnerabilities"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/security/summary"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/security/dashboard"] });
      setEditTarget(null); setForm({ ...EMPTY_FORM }); setErrors({}); setLogSectionOpen(false);
    } catch {
      setErrors({ submit: `Failed to ${editTarget ? "update" : "create"} vulnerability.` });
    }
  };

  const SEV_STYLES: Record<string, string> = {
    critical: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800",
    high: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200 dark:border-orange-800",
    medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    low: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    info: "bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-400 border-gray-200 dark:border-gray-700",
  };

  const appLabel = (vuln: VulnRow) => vuln.applicationName ?? (vuln.applicationId != null ? `App #${vuln.applicationId}` : '—');
  const metaLine = (vuln: VulnRow) => {
    const parts = [vuln.cveId, vuln.affectedComponent].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : null;
  };

  const attentionCategories = useMemo(() => {
    if (!dashboard) return [];
    return [
      {
        key: "patches", label: "Servers Missing Patches", short: "Patches", icon: ServerCog,
        items: dashboard.serversMissingPatches, tone: toneOf(dashboard.serversMissingPatches.length),
        emptyLabel: "All servers are patched.",
        render: (s: any) => (
          <div className="flex items-center justify-between gap-2">
            <div><p className="text-sm font-medium">{s.name}</p>
              <p className="text-xs text-muted-foreground">{s.lastPatchedAt ? `Last patched ${new Date(s.lastPatchedAt).toLocaleDateString()}` : "Never patched"}</p>
            </div>
            <Badge variant="outline" className="capitalize text-[10px]">{s.patchStatus}</Badge>
          </div>
        ),
      },
      {
        key: "criticalVulns", label: "Apps with Critical Vulnerabilities", short: "Critical Vulns", icon: ShieldAlert,
        items: dashboard.applicationsWithCriticalVulnerabilities, tone: toneOf(dashboard.applicationsWithCriticalVulnerabilities.length, "danger"),
        emptyLabel: "No applications with open critical vulnerabilities.",
        render: (a: any) => (
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">{a.applicationName ?? `App #${a.applicationId}`}</p>
            <Badge variant="destructive" className="text-[10px]">{a.criticalCount} critical</Badge>
          </div>
        ),
      },
      {
        key: "ssl", label: "SSL Certificates Expiring Soon", short: "SSL", icon: KeyRound,
        items: dashboard.sslCertificatesExpiringSoon, tone: toneOf(dashboard.sslCertificatesExpiringSoon.length),
        emptyLabel: "No SSL certificates expiring soon.",
        render: (d: any) => (
          <div className="flex items-center justify-between gap-2">
            <div><p className="text-sm font-medium">{d.name}</p>
              <p className="text-xs text-muted-foreground">{d.sslExpiry ? new Date(d.sslExpiry).toLocaleDateString() : "N/A"}</p>
            </div>
            {daysRemainingBadge(d.daysRemaining)}
          </div>
        ),
      },
      {
        key: "domains", label: "Domains Expiring Soon", short: "Domains", icon: Globe2,
        items: dashboard.domainsExpiringSoon, tone: toneOf(dashboard.domainsExpiringSoon.length),
        emptyLabel: "No domains expiring soon.",
        render: (d: any) => (
          <div className="flex items-center justify-between gap-2">
            <div><p className="text-sm font-medium">{d.name}</p>
              <p className="text-xs text-muted-foreground">{d.registrationExpiry ? new Date(d.registrationExpiry).toLocaleDateString() : "N/A"}</p>
            </div>
            {daysRemainingBadge(d.daysRemaining)}
          </div>
        ),
      },
      {
        key: "backups", label: "Failed Backups", short: "Backups", icon: DatabaseBackup,
        items: dashboard.failedBackups, tone: toneOf(dashboard.failedBackups.length, "danger"),
        emptyLabel: "All backups completed successfully.",
        render: (b: any) => (
          <div className="flex items-center justify-between gap-2">
            <div><p className="text-sm font-medium">{b.name}</p>
              <p className="text-xs text-muted-foreground">{b.lastBackupAt ? new Date(b.lastBackupAt).toLocaleString() : "Never backed up"}</p>
            </div>
            <Badge variant="destructive" className="capitalize text-[10px]">{b.lastBackupStatus}</Badge>
          </div>
        ),
      },
      {
        key: "adminUsers", label: "Admin Users", short: "Admins", icon: UserCog,
        items: dashboard.adminUsers, tone: "default" as const,
        emptyLabel: "No admin users found.",
        render: (u: any) => (
          <div className="flex items-center justify-between gap-2">
            <div><p className="text-sm font-medium">{u.name}</p>
              <p className="text-xs text-muted-foreground">{u.email}</p>
            </div>
            {u.department && <Badge variant="outline" className="text-[10px]">{u.department}</Badge>}
          </div>
        ),
      },
      {
        key: "secrets", label: "Repos with Exposed Secrets", short: "Secrets", icon: LockKeyholeOpen,
        items: dashboard.reposWithExposedSecrets, tone: toneOf(dashboard.reposWithExposedSecrets.length, "danger"),
        emptyLabel: "No repositories with exposed secrets.",
        render: (r: any) => (
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">{r.name}</p>
            <p className="text-xs text-muted-foreground">{r.lastScannedAt ? `Scanned ${new Date(r.lastScannedAt).toLocaleDateString()}` : "Never scanned"}</p>
          </div>
        ),
      },
      {
        key: "dependencies", label: "Outdated Dependencies", short: "Dependencies", icon: PackageX,
        items: dashboard.outdatedDependencies, tone: toneOf(dashboard.outdatedDependencies.length),
        emptyLabel: "All dependencies are current.",
        render: (d: any) => (
          <div className="flex items-center justify-between gap-2">
            <div><p className="text-sm font-medium">{d.name}</p>
              <p className="text-xs text-muted-foreground font-mono">{d.installedVersion ?? "?"} → {d.latestVersion ?? "?"}</p>
            </div>
            {d.endOfLife && <Badge variant="destructive" className="text-[10px]">EOL</Badge>}
          </div>
        ),
      },
      {
        key: "scans", label: "Applications Not Recently Scanned", short: "Scans", icon: ScanEye,
        items: dashboard.applicationsNotRecentlyScanned, tone: toneOf(dashboard.applicationsNotRecentlyScanned.length),
        emptyLabel: "All applications have been scanned recently.",
        render: (a: any) => (
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">{a.name}</p>
            <p className="text-xs text-muted-foreground">{a.lastSecurityScanAt ? `Scanned ${new Date(a.lastSecurityScanAt).toLocaleDateString()}` : "Never scanned"}</p>
          </div>
        ),
      },
    ];
  }, [dashboard]);

  const defaultTab = useMemo(() => {
    const flagged = attentionCategories.find(c => c.items.length > 0 && c.tone !== "ok" && c.tone !== "default");
    return flagged?.key ?? attentionCategories[0]?.key ?? "patches";
  }, [attentionCategories]);

  const totalFlagged = useMemo(() =>
    attentionCategories.filter(c => c.items.length > 0 && c.tone !== "ok" && c.tone !== "default")
      .reduce((n, c) => n + c.items.length, 0),
    [attentionCategories]);

  const criticalHigh = summary ? summary.critical + summary.high : 0;
  const vulnCount = vulnerabilities?.length ?? 0;
  const riskIssueCount = dashboard
    ? dashboard.serversMissingPatches.length + dashboard.applicationsWithCriticalVulnerabilities.length
    + dashboard.failedBackups.length + dashboard.reposWithExposedSecrets.length : 0;
  const riskHasDanger = dashboard
    ? dashboard.applicationsWithCriticalVulnerabilities.length > 0 || dashboard.failedBackups.length > 0 || dashboard.reposWithExposedSecrets.length > 0 : false;

  return (
    <div className="max-w-4xl space-y-2.5">
      {/* Page header */}
      <div className="flex items-center justify-between pb-1">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Security</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Risk posture and vulnerability log</p>
        </div>
      </div>

      {/* 1 — Vulnerability Health */}
      <Section
        id="vulnerability-health"
        title="Vulnerability Health"
        icon={Activity}
        defaultOpen={true}
        alert={criticalHigh > 0}
        badge={criticalHigh > 0 ? `${criticalHigh} critical/high` : "Clear"}
        badgeVariant={criticalHigh > 0 ? "destructive" : "outline"}
      >
        {summaryLoading ? (
          <Skeleton className="h-28 w-full mt-3" />
        ) : summary ? (
          <div className="flex flex-col sm:flex-row items-center gap-6 pt-3">
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <ScoreRing score={summary.securityScore} />
              <p className="text-xs text-muted-foreground">Security Score</p>
            </div>
            <div className="grid grid-cols-3 gap-3 flex-1 w-full sm:border-l sm:pl-6">
              <div className="flex flex-col items-center gap-1 p-3 rounded-lg bg-red-50 dark:bg-red-950/30">
                <ShieldAlert className="h-4 w-4 text-red-500" />
                <span className="text-2xl font-bold text-red-600 dark:text-red-400 leading-none">{summary.critical + summary.high}</span>
                <span className="text-[10px] text-muted-foreground text-center">Critical / High</span>
              </div>
              <div className="flex flex-col items-center gap-1 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                <Clock className="h-4 w-4 text-amber-500" />
                <span className="text-2xl font-bold text-amber-600 dark:text-amber-400 leading-none">{summary.inProgress}</span>
                <span className="text-[10px] text-muted-foreground text-center">In Progress</span>
              </div>
              <div className="flex flex-col items-center gap-1 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 leading-none">{summary.resolved}</span>
                <span className="text-[10px] text-muted-foreground text-center">Resolved</span>
              </div>
            </div>
          </div>
        ) : null}
      </Section>

      {/* 2 — Log Vulnerability */}
      <div id="log-vulnerability" className="rounded-xl border bg-card scroll-mt-4 overflow-hidden transition-shadow hover:shadow-sm">
        <button
          type="button"
          onClick={() => { setLogSectionOpen(v => !v); if (logSectionOpen) { setEditTarget(null); setForm({ ...EMPTY_FORM }); setErrors({}); } }}
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          <div className="h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0 bg-primary/10">
            <PenLine className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="font-medium text-sm flex-1">{editTarget ? "Edit Vulnerability" : "Log Vulnerability"}</span>
          <div className="flex items-center gap-2 flex-shrink-0">
            {editTarget && <Badge variant="secondary" className="text-[10px] h-5 px-1.5">Editing</Badge>}
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${logSectionOpen ? "rotate-180" : ""}`} />
          </div>
        </button>
        <div className="grid transition-all duration-200 ease-in-out" style={{ gridTemplateRows: logSectionOpen ? "1fr" : "0fr" }}>
          <div className="overflow-hidden">
            <div className="px-4 pb-4 pt-1 border-t border-border/50">
              <div className="pt-3 space-y-4">
                {errors.submit && <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{errors.submit}</div>}
                {editTarget && (
                  <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                    <p className="text-xs font-medium">Editing: <span className="text-primary">{editTarget.title}</span></p>
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setEditTarget(null); setForm({ ...EMPTY_FORM }); setErrors({}); }}>
                      New instead
                    </Button>
                  </div>
                )}
                {/* Core fields */}
                <div className="space-y-3">
                  <Field label="Title" required error={errors.title}>
                    <Input placeholder="e.g. SQL Injection in login endpoint" value={form.title} onChange={set("title")} className="h-9 text-sm" />
                  </Field>
                  <Field label="Description">
                    <Textarea placeholder="Describe the vulnerability and its impact…" value={form.description} onChange={set("description")} rows={2} className="resize-none text-sm" />
                  </Field>
                </div>
                {/* Classification */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Classification</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Field label="Severity" required error={errors.severity}>
                      <SelectField value={form.severity} onValueChange={v => setForm(f => ({ ...f, severity: v }))} placeholder="Severity" options={SEVERITY_OPTIONS} />
                    </Field>
                    <Field label="Status">
                      <SelectField value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))} placeholder="Status" options={STATUS_OPTIONS} />
                    </Field>
                    <Field label="Category">
                      <SelectField value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))} placeholder="Category" options={CATEGORY_OPTIONS} />
                    </Field>
                    <Field label="Team">
                      <TeamSelectField value={form.teamId} onValueChange={v => setForm(f => ({ ...f, teamId: v }))} />
                    </Field>
                  </div>
                </div>
                {/* References */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">References</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <Field label="CVE ID">
                      <Input placeholder="CVE-2024-12345" value={form.cveId} onChange={set("cveId")} className="h-9 text-sm font-mono" />
                    </Field>
                    <Field label="Application ID" error={errors.applicationId}>
                      <Input type="number" placeholder="App ID" value={form.applicationId} onChange={set("applicationId")} className="h-9 text-sm" />
                    </Field>
                    <Field label="Affected Component">
                      <Input placeholder="auth/login.ts" value={form.affectedComponent} onChange={set("affectedComponent")} className="h-9 text-sm font-mono" />
                    </Field>
                  </div>
                </div>
                {/* Software metadata */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Software Metadata</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Field label="Vendor">
                      <Input placeholder="e.g. Microsoft" value={form.vendor} onChange={set("vendor")} className="h-9 text-sm" />
                    </Field>
                    <Field label="Version">
                      <Input placeholder="18.2.0" value={form.version} onChange={set("version")} className="h-9 text-sm font-mono" />
                    </Field>
                    <Field label="License Type">
                      <Input placeholder="MIT" value={form.licenseType} onChange={set("licenseType")} className="h-9 text-sm" />
                    </Field>
                    <Field label="Assigned To">
                      <Input placeholder="Engineer name" value={form.assignedTo} onChange={set("assignedTo")} className="h-9 text-sm" />
                    </Field>
                    <Field label="Discovered At">
                      <Input type="date" value={form.discoveredAt} onChange={set("discoveredAt")} className="h-9 text-sm" />
                    </Field>
                    <Field label="Installation Date">
                      <Input type="date" value={form.installationDate} onChange={set("installationDate")} className="h-9 text-sm" />
                    </Field>
                    <Field label="License Expiration">
                      <Input type="date" value={form.licenseExpiration} onChange={set("licenseExpiration")} className="h-9 text-sm" />
                    </Field>
                    <Field label="End of Life Date">
                      <Input type="date" value={form.endOfLifeDate} onChange={set("endOfLifeDate")} className="h-9 text-sm" />
                    </Field>
                  </div>
                </div>
                <Field label="Notes">
                  <Textarea placeholder="Remediation steps, additional context…" value={form.notes} onChange={set("notes")} rows={2} className="resize-none text-sm" />
                </Field>
                <div className="flex items-center gap-2 pt-1">
                  <Button size="sm" onClick={handleSubmit} disabled={isPending}>
                    {isPending
                      ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />{editTarget ? "Saving…" : "Logging…"}</>
                      : editTarget ? "Save Changes" : "Log Vulnerability"}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={isPending}
                    onClick={() => { setLogSectionOpen(false); setEditTarget(null); setForm({ ...EMPTY_FORM }); setErrors({}); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3 — Risk Indicators */}
      <Section
        id="risk-indicators"
        title="Risk Indicators"
        icon={AlertTriangle}
        defaultOpen={false}
        alert={riskHasDanger}
        badge={dashboard ? (riskIssueCount > 0 ? `${riskIssueCount} issues` : "All clear") : undefined}
        badgeVariant={riskHasDanger ? "destructive" : riskIssueCount > 0 ? "secondary" : "outline"}
      >
        {dashboardLoading ? (
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-5 pt-3">
            {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : dashboard ? (
          <div className="pt-3 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <KpiCard icon={Layers} label="Systems in Production" value={dashboard.systemsInProduction} />
              <KpiCard icon={ServerCog} label="Servers Missing Patches" value={dashboard.serversMissingPatches.length} tone={toneOf(dashboard.serversMissingPatches.length)} />
              <KpiCard icon={ShieldAlert} label="Apps w/ Critical Vulns" value={dashboard.applicationsWithCriticalVulnerabilities.length} tone={toneOf(dashboard.applicationsWithCriticalVulnerabilities.length, "danger")} />
              <KpiCard icon={KeyRound} label="SSL Expiring &lt;30d" value={dashboard.sslCertificatesExpiringSoon.length} tone={toneOf(dashboard.sslCertificatesExpiringSoon.length)} />
              <KpiCard icon={Globe2} label="Domains Expiring Soon" value={dashboard.domainsExpiringSoon.length} tone={toneOf(dashboard.domainsExpiringSoon.length)} />
              <KpiCard icon={DatabaseBackup} label="Failed Backups" value={dashboard.failedBackups.length} tone={toneOf(dashboard.failedBackups.length, "danger")} />
              <KpiCard icon={UserCog} label="Admin Users" value={dashboard.adminUsers.length} />
              <KpiCard icon={LockKeyholeOpen} label="Repos w/ Exposed Secrets" value={dashboard.reposWithExposedSecrets.length} tone={toneOf(dashboard.reposWithExposedSecrets.length, "danger")} />
              <KpiCard icon={PackageX} label="Outdated Dependencies" value={dashboard.outdatedDependencies.length} tone={toneOf(dashboard.outdatedDependencies.length)} />
              <KpiCard icon={ScanEye} label="Apps Not Scanned" value={dashboard.applicationsNotRecentlyScanned.length} tone={toneOf(dashboard.applicationsNotRecentlyScanned.length)} />
            </div>
            <p className="text-[10px] text-muted-foreground">Last computed {new Date(dashboard.generatedAt).toLocaleString()}</p>
          </div>
        ) : null}
      </Section>

      {/* 4 — Needs Attention */}
      <Section
        id="needs-attention"
        title="Needs Attention"
        icon={Shield}
        defaultOpen={false}
        alert={totalFlagged > 0}
        badge={dashboard ? (totalFlagged > 0 ? `${totalFlagged} flagged` : "All clear") : undefined}
        badgeVariant={totalFlagged > 0 ? "destructive" : "outline"}
      >
        {dashboardLoading ? (
          <Skeleton className="h-24 w-full mt-3" />
        ) : dashboard ? (
          <div className="pt-3">
            <Tabs defaultValue={defaultTab}>
              <div className="overflow-x-auto -mx-1 px-1 pb-2">
                <TabsList className="h-auto flex-nowrap gap-0.5 p-1">
                  {attentionCategories.map(cat => (
                    <TabsTrigger key={cat.key} value={cat.key} className="gap-1.5 shrink-0 h-7 text-xs px-2.5">
                      <cat.icon className="h-3 w-3" />
                      <span>{cat.short}</span>
                      {cat.items.length > 0 && (
                        <Badge variant={TONE_BADGE[cat.tone]} className="ml-0.5 h-4 min-w-4 px-1 text-[9px] justify-center">
                          {cat.items.length}
                        </Badge>
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              {attentionCategories.map(cat => (
                <TabsContent key={cat.key} value={cat.key} className="mt-2">
                  <DrillDownList items={cat.items} emptyLabel={cat.emptyLabel} render={cat.render} />
                </TabsContent>
              ))}
            </Tabs>
          </div>
        ) : null}
      </Section>

      {/* 5 — Vulnerabilities */}
      <Section
        id="vulnerabilities"
        title="Vulnerabilities"
        icon={Table2}
        defaultOpen={true}
        badge={vulnCount > 0 ? `${vulnCount}` : "None"}
        badgeVariant="outline"
      >
        <div className="pt-2">
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={resetCreate} className="h-8 text-xs gap-1.5">
              <Plus className="h-3.5 w-3.5" />Log Vulnerability
            </Button>
          </div>
          {vulnsLoading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : vulnerabilities && vulnerabilities.length > 0 ? (
            <div className="overflow-x-auto -mx-4 rounded-none">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-medium h-8">Finding</TableHead>
                    <TableHead className="text-xs font-medium h-8 w-24">Severity</TableHead>
                    <TableHead className="text-xs font-medium h-8">Application</TableHead>
                    <TableHead className="text-xs font-medium h-8 w-28">Status</TableHead>
                    <TableHead className="text-xs font-medium h-8">Team</TableHead>
                    <TableHead className="w-16 h-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedVulnerabilities.map((vuln) => (
                    <TableRow key={vuln.id} className="group">
                      <TableCell className="py-2.5">
                        <div className="text-sm font-medium leading-snug">{vuln.title}</div>
                        {metaLine(vuln as VulnRow) && (
                          <div className="text-[10px] text-muted-foreground font-mono mt-0.5 leading-none">{metaLine(vuln as VulnRow)}</div>
                        )}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold capitalize ${SEV_STYLES[vuln.severity] ?? SEV_STYLES.info}`}>
                          {vuln.severity}
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5 text-sm text-muted-foreground">{appLabel(vuln as VulnRow)}</TableCell>
                      <TableCell className="py-2.5">
                        <Badge variant="outline" className="capitalize text-[10px] font-normal">{vuln.status.replace(/_/g, " ")}</Badge>
                      </TableCell>
                      <TableCell className="py-2.5"><TeamBadge teamId={(vuln as VulnRow).teamId} /></TableCell>
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(vuln as VulnRow)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(vuln as VulnRow)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Shield className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-3">No vulnerabilities recorded yet.</p>
              <Button size="sm" variant="outline" onClick={resetCreate}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />Log First Vulnerability
              </Button>
            </div>
          )}
          <TablePagination page={page} totalPages={totalPages} onPageChange={setPage} startIndex={startIndex} endIndex={endIndex} total={total} />
        </div>
      </Section>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
        entityName="vulnerability"
        itemLabel={deleteTarget?.title ?? ""}
        isPending={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
