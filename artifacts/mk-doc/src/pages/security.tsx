import React, { useMemo, useState } from "react";
import { ExportButton } from "@/components/export-button";
import { z } from "zod";
import {
  useListVulnerabilities, useGetSecuritySummary, useGetSecurityDashboard,
  useCreateVulnerability, useUpdateVulnerability, useDeleteVulnerability,
  useListApplications,
} from "@workspace/api-client-react";
import { CreateVulnerabilityBody } from "@workspace/api-zod";
import { numericStringField, getFieldErrors } from "@/lib/form-validation";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import { OwnerBadge } from "@/components/owner-badge";
import { OwnerSelectField } from "@/components/owner-select-field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Shield, ShieldAlert, CheckCircle, Plus, Loader2, Pencil, Trash2,
  ServerCog, KeyRound, LockKeyholeOpen, Globe2, DatabaseBackup, UserCog,
  PackageX, ScanEye, Layers,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { TablePagination } from "@/components/table-pagination";
import { usePagination } from "@/hooks/use-pagination";

// ── Constants ──────────────────────────────────────────────────────────────────
const SEVERITY_OPTIONS = ["critical", "high", "medium", "low", "info"];
const STATUS_OPTIONS   = ["open", "in_progress", "resolved", "accepted", "false_positive"];
const CATEGORY_OPTIONS = ["productivity", "security", "development", "database", "infrastructure", "communication", "analytics", "other"];

const vulnFormSchema = CreateVulnerabilityBody.extend({
  severity:      CreateVulnerabilityBody.shape.severity.min(1, "Required"),
  status:        CreateVulnerabilityBody.shape.status.min(1, "Required"),
  applicationId: numericStringField(z.coerce.number({ invalid_type_error: "Invalid ID" }).int().positive()),
  ownerId:       numericStringField(z.coerce.number({ invalid_type_error: "Invalid owner" }).int().positive()),
});

type VulnRow = {
  id: number; title: string; description?: string | null; severity: string; status: string;
  applicationId?: number | null; applicationName?: string | null; cveId?: string | null;
  affectedComponent?: string | null; version?: string | null; vendor?: string | null;
  category?: string | null; discoveredAt?: string | null; resolvedAt?: string | null;
  assignedTo?: string | null; notes?: string | null; ownerId?: number | null; ownerName?: string | null;
};

const VULN_EXPORT_COLS = [
  { key: "title",             label: "Finding" },
  { key: "severity",          label: "Severity" },
  { key: "status",            label: "Status" },
  { key: "cveId",             label: "CVE ID" },
  { key: "affectedComponent", label: "Affected Component" },
  { key: "applicationName",   label: "Application" },
  { key: "version",           label: "Version" },
  { key: "vendor",            label: "Vendor" },
  { key: "category",          label: "Category" },
  { key: "discoveredAt",      label: "Discovered At" },
  { key: "assignedTo",        label: "Assigned To" },
  { key: "ownerName",         label: "Owner" },
];

const EMPTY_FORM = {
  title: "", description: "", severity: "medium", status: "open",
  applicationId: "", cveId: "", affectedComponent: "",
  version: "", vendor: "", category: "",
  discoveredAt: "", resolvedAt: "", assignedTo: "", notes: "", ownerId: "",
};

// ── Severity / Status style maps ───────────────────────────────────────────────
const SEV_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800",
  high:     "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  medium:   "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  low:      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  info:     "bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-400 border-gray-200 dark:border-gray-700",
};

const TONE_BG:   Record<string, string>                              = { danger: "bg-red-50 dark:bg-red-950/30", warning: "bg-amber-50 dark:bg-amber-950/30", ok: "bg-emerald-50 dark:bg-emerald-950/20", default: "bg-muted/40" };
const TONE_TEXT: Record<string, string>                              = { danger: "text-destructive", warning: "text-amber-600", ok: "text-emerald-600", default: "text-foreground" };
const TONE_ICON: Record<string, string>                              = { danger: "text-red-500", warning: "text-amber-500", ok: "text-emerald-500", default: "text-muted-foreground" };
const TONE_BADGE: Record<string, "destructive"|"secondary"|"outline"> = { danger: "destructive", warning: "secondary", ok: "outline", default: "outline" };

function toneOf(n: number, dangerIfAny: "danger"|"warning" = "warning") { return n > 0 ? dangerIfAny : "ok"; }

// ── Sub-components ─────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const r = 34, circ = 2 * Math.PI * r;
  const color = score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";
  const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={88} height={88} viewBox="0 0 88 88" className="-rotate-90">
        <circle cx={44} cy={44} r={r} fill="none" strokeWidth={7} className="stroke-muted/40" />
        <circle cx={44} cy={44} r={r} fill="none" strokeWidth={7}
          stroke={color} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ - (score / 100) * circ}
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center leading-none gap-0.5">
        <span className="text-xl font-bold" style={{ color }}>{score}</span>
        <span className="text-[9px] text-muted-foreground">Grade {grade}</span>
      </div>
    </div>
  );
}

function KpiTile({ icon: Icon, label, value, tone = "default" }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: number; tone?: string;
}) {
  return (
    <div className={`flex flex-col gap-2 p-3 rounded-lg ${TONE_BG[tone]}`}>
      <div className="flex items-center justify-between">
        <Icon className={`h-3.5 w-3.5 ${TONE_ICON[tone]}`} />
        <span className={`text-xl font-bold leading-none ${TONE_TEXT[tone]}`}>{value}</span>
      </div>
      <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
    </div>
  );
}

function Field({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
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

function daysRemainingBadge(days?: number | null) {
  if (days == null) return null;
  const overdue = days < 0, urgent = !overdue && days <= 7;
  return (
    <Badge variant={overdue || urgent ? "destructive" : "secondary"} className="font-mono text-[10px]">
      {overdue ? `${Math.abs(days)}d overdue` : `${days}d left`}
    </Badge>
  );
}

function DrillList({ items, emptyLabel, render }: {
  items: unknown[]; emptyLabel: string; render: (item: any, i: number) => React.ReactNode;
}) {
  if (!items?.length) {
    return (
      <div className="flex flex-col items-center py-6 text-center">
        <CheckCircle className="h-6 w-6 text-emerald-400 mb-1.5" />
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border/60">
      {items.map((item, i) => <li key={i} className="py-2.5 first:pt-0 last:pb-0">{render(item, i)}</li>)}
    </ul>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Security() {
  const { data: vulnerabilities, isLoading: vulnsLoading }   = useListVulnerabilities();
  const { data: summary,         isLoading: summaryLoading } = useGetSecuritySummary();
  const { data: dashboard,       isLoading: dashLoading }    = useGetSecurityDashboard();
  const { data: applications }                               = useListApplications();
  const { mutateAsync: createVulnerability, isPending: isCreating } = useCreateVulnerability();
  const { mutateAsync: updateVulnerability, isPending: isUpdating } = useUpdateVulnerability();
  const { mutateAsync: deleteVulnerability, isPending: isDeleting } = useDeleteVulnerability();
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen]       = useState(false);
  const [editTarget, setEditTarget]   = useState<VulnRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VulnRow | null>(null);
  const [form, setForm]               = useState({ ...EMPTY_FORM });
  const [errors, setErrors]           = useState<Record<string, string>>({});
  const isPending = isCreating || isUpdating;

  const { page, setPage, totalPages, pageItems: pagedVulns, startIndex, endIndex, total } =
    usePagination(vulnerabilities, 10);

  const set = (field: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }));

  const closeForm = () => { setFormOpen(false); setEditTarget(null); setForm({ ...EMPTY_FORM }); setErrors({}); };

  const openCreate = () => { setEditTarget(null); setForm({ ...EMPTY_FORM }); setErrors({}); setFormOpen(true); };

  const openEdit = (v: VulnRow) => {
    setEditTarget(v);
    setForm({
      title: v.title ?? "", description: v.description ?? "",
      severity: v.severity ?? "medium", status: v.status ?? "open",
      applicationId: v.applicationId?.toString() ?? "",
      cveId: v.cveId ?? "", affectedComponent: v.affectedComponent ?? "",
      version: v.version ?? "", vendor: v.vendor ?? "", category: v.category ?? "",
      discoveredAt: v.discoveredAt ? v.discoveredAt.substring(0, 10) : "",
      resolvedAt:   v.resolvedAt   ? v.resolvedAt.substring(0, 10)   : "",
      assignedTo: v.assignedTo ?? "", notes: v.notes ?? "",
      ownerId: v.ownerId?.toString() ?? "",
    });
    setErrors({}); setFormOpen(true);
  };

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/security/vulnerabilities"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/security/summary"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/security/dashboard"] });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await deleteVulnerability({ id: deleteTarget.id }); await invalidate(); setDeleteTarget(null); } catch { }
  };

  const handleSubmit = async () => {
    const result = getFieldErrors(vulnFormSchema, form);
    if ("errors" in result) { setErrors(result.errors); return; }
    setErrors({});
    const p = result.data;
    const payload = {
      ...p,
      description:       p.description       || undefined,
      cveId:             p.cveId             || undefined,
      affectedComponent: p.affectedComponent || undefined,
      version:           form.version        || undefined,
      vendor:            form.vendor         || undefined,
      category:          form.category       || undefined,
      discoveredAt:      p.discoveredAt      || undefined,
      resolvedAt:        form.resolvedAt      || undefined,
      assignedTo:        p.assignedTo        || undefined,
      notes:             p.notes             || undefined,
      ownerId:           form.ownerId ? Number(form.ownerId) : null,
    };
    try {
      if (editTarget) await updateVulnerability({ id: editTarget.id, data: payload });
      else await createVulnerability({ data: payload });
      await invalidate();
      closeForm();
    } catch {
      setErrors({ submit: `Failed to ${editTarget ? "update" : "save"} vulnerability.` });
    }
  };

  // ── Needs-Attention categories ─────────────────────────────────────────────
  const attentionCategories = useMemo(() => {
    if (!dashboard) return [];
    return [
      {
        key: "patches", short: "Patches", icon: ServerCog,
        items: dashboard.serversMissingPatches,
        tone: toneOf(dashboard.serversMissingPatches.length),
        emptyLabel: "All servers are patched.",
        render: (s: any) => (
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">{s.name}</p>
              <p className="text-xs text-muted-foreground">{s.lastPatchedAt ? `Last patched ${new Date(s.lastPatchedAt).toLocaleDateString()}` : "Never patched"}</p>
            </div>
            <Badge variant="outline" className="capitalize text-[10px]">{s.patchStatus}</Badge>
          </div>
        ),
      },
      {
        key: "criticalVulns", short: "Critical", icon: ShieldAlert,
        items: dashboard.applicationsWithCriticalVulnerabilities,
        tone: toneOf(dashboard.applicationsWithCriticalVulnerabilities.length, "danger"),
        emptyLabel: "No apps with open critical vulnerabilities.",
        render: (a: any) => (
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">{a.applicationName ?? `App #${a.applicationId}`}</p>
            <Badge variant="destructive" className="text-[10px]">{a.criticalCount} critical</Badge>
          </div>
        ),
      },
      {
        key: "ssl", short: "SSL", icon: KeyRound,
        items: dashboard.sslCertificatesExpiringSoon,
        tone: toneOf(dashboard.sslCertificatesExpiringSoon.length),
        emptyLabel: "No SSL certs expiring soon.",
        render: (d: any) => (
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">{d.name}</p>
              <p className="text-xs text-muted-foreground">{d.sslExpiry ? new Date(d.sslExpiry).toLocaleDateString() : "N/A"}</p>
            </div>
            {daysRemainingBadge(d.daysRemaining)}
          </div>
        ),
      },
      {
        key: "domains", short: "Domains", icon: Globe2,
        items: dashboard.domainsExpiringSoon,
        tone: toneOf(dashboard.domainsExpiringSoon.length),
        emptyLabel: "No domains expiring soon.",
        render: (d: any) => (
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">{d.name}</p>
              <p className="text-xs text-muted-foreground">{d.registrationExpiry ? new Date(d.registrationExpiry).toLocaleDateString() : "N/A"}</p>
            </div>
            {daysRemainingBadge(d.daysRemaining)}
          </div>
        ),
      },
      {
        key: "backups", short: "Backups", icon: DatabaseBackup,
        items: dashboard.failedBackups,
        tone: toneOf(dashboard.failedBackups.length, "danger"),
        emptyLabel: "All backups completed successfully.",
        render: (b: any) => (
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">{b.name}</p>
              <p className="text-xs text-muted-foreground">{b.lastBackupAt ? new Date(b.lastBackupAt).toLocaleString() : "Never backed up"}</p>
            </div>
            <Badge variant="destructive" className="capitalize text-[10px]">{b.lastBackupStatus}</Badge>
          </div>
        ),
      },
      {
        key: "admins", short: "Admins", icon: UserCog,
        items: dashboard.adminUsers,
        tone: "default" as const,
        emptyLabel: "No admin users found.",
        render: (u: any) => (
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">{u.name}</p>
              <p className="text-xs text-muted-foreground">{u.email}</p>
            </div>
            {u.department && <Badge variant="outline" className="text-[10px]">{u.department}</Badge>}
          </div>
        ),
      },
      {
        key: "secrets", short: "Secrets", icon: LockKeyholeOpen,
        items: dashboard.reposWithExposedSecrets,
        tone: toneOf(dashboard.reposWithExposedSecrets.length, "danger"),
        emptyLabel: "No repositories with exposed secrets.",
        render: (r: any) => (
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">{r.name}</p>
            <p className="text-xs text-muted-foreground">{r.lastScannedAt ? `Scanned ${new Date(r.lastScannedAt).toLocaleDateString()}` : "Never scanned"}</p>
          </div>
        ),
      },
      {
        key: "deps", short: "Outdated", icon: PackageX,
        items: dashboard.outdatedDependencies,
        tone: toneOf(dashboard.outdatedDependencies.length),
        emptyLabel: "All dependencies are current.",
        render: (d: any) => (
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">{d.name}</p>
              <p className="text-xs text-muted-foreground font-mono">{d.installedVersion ?? "?"} → {d.latestVersion ?? "?"}</p>
            </div>
            {d.endOfLife && <Badge variant="destructive" className="text-[10px]">EOL</Badge>}
          </div>
        ),
      },
      {
        key: "scans", short: "Scans", icon: ScanEye,
        items: dashboard.applicationsNotRecentlyScanned,
        tone: toneOf(dashboard.applicationsNotRecentlyScanned.length),
        emptyLabel: "All applications scanned recently.",
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

  const vulnCount = vulnerabilities?.length ?? 0;
  const isResolved = form.status === "resolved" || form.status === "accepted";

  return (
    <div className="space-y-5 max-w-5xl">

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Security</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Risk posture and vulnerability tracking</p>
      </div>

      {/* ── Score + Severity + KPI grid ──────────────────────────────────────── */}
      <Card id="risk-indicators">
        <CardContent className="pt-5 pb-5">
          {summaryLoading ? (
            <Skeleton className="h-28 w-full" />
          ) : summary ? (
            <div className="flex flex-col lg:flex-row gap-6">

              {/* Score ring */}
              <div className="flex flex-col items-center gap-1 shrink-0">
                <ScoreRing score={summary.securityScore} />
                <p className="text-xs text-muted-foreground">Security Score</p>
              </div>

              {/* Severity bars */}
              <div className="flex-1 min-w-0 lg:border-l lg:pl-6 space-y-2.5 justify-center flex flex-col">
                {[
                  { label: "Critical", count: summary.critical, bar: "bg-red-500" },
                  { label: "High",     count: summary.high,     bar: "bg-orange-500" },
                  { label: "Medium",   count: summary.medium,   bar: "bg-amber-500" },
                  { label: "Low",      count: summary.low,      bar: "bg-blue-400" },
                ].map(({ label, count, bar }) => {
                  const total = summary.critical + summary.high + summary.medium + summary.low;
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-14 shrink-0">{label}</span>
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${bar} rounded-full`} style={{ width: `${pct}%`, transition: "width 0.8s ease" }} />
                      </div>
                      <span className="text-xs font-medium w-5 text-right tabular-nums">{count}</span>
                    </div>
                  );
                })}
                <div className="flex gap-4 pt-1.5 border-t border-border/50">
                  <span className="text-xs text-muted-foreground">Open <span className="font-semibold text-foreground">{summary.open}</span></span>
                  <span className="text-xs text-muted-foreground">In Progress <span className="font-semibold text-amber-600">{summary.inProgress}</span></span>
                  <span className="text-xs text-muted-foreground">Resolved <span className="font-semibold text-emerald-600">{summary.resolved}</span></span>
                </div>
              </div>

              {/* KPI tiles — 5×2 grid */}
              {dashLoading || !dashboard ? (
                <div className="grid grid-cols-5 gap-2 shrink-0">
                  {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-14 w-20" />)}
                </div>
              ) : (
                <div className="grid grid-cols-5 gap-2 shrink-0 lg:border-l lg:pl-6">
                  {[
                    { icon: Layers,          label: "Production",  value: dashboard.systemsInProduction,                           tone: "default" },
                    { icon: ServerCog,       label: "Unpatched",   value: dashboard.serversMissingPatches.length,                  tone: toneOf(dashboard.serversMissingPatches.length) },
                    { icon: ShieldAlert,     label: "Critical",    value: dashboard.applicationsWithCriticalVulnerabilities.length, tone: toneOf(dashboard.applicationsWithCriticalVulnerabilities.length, "danger") },
                    { icon: KeyRound,        label: "SSL exp.",     value: dashboard.sslCertificatesExpiringSoon.length,            tone: toneOf(dashboard.sslCertificatesExpiringSoon.length) },
                    { icon: Globe2,          label: "Domains",     value: dashboard.domainsExpiringSoon.length,                    tone: toneOf(dashboard.domainsExpiringSoon.length) },
                    { icon: DatabaseBackup,  label: "Backups",     value: dashboard.failedBackups.length,                          tone: toneOf(dashboard.failedBackups.length, "danger") },
                    { icon: UserCog,         label: "Admins",      value: dashboard.adminUsers.length,                             tone: "default" },
                    { icon: LockKeyholeOpen, label: "Secrets",     value: dashboard.reposWithExposedSecrets.length,                tone: toneOf(dashboard.reposWithExposedSecrets.length, "danger") },
                    { icon: PackageX,        label: "Outdated",    value: dashboard.outdatedDependencies.length,                   tone: toneOf(dashboard.outdatedDependencies.length) },
                    { icon: ScanEye,         label: "Unscanned",   value: dashboard.applicationsNotRecentlyScanned.length,         tone: toneOf(dashboard.applicationsNotRecentlyScanned.length) },
                  ].map((kpi, i) => (
                    <KpiTile key={i} icon={kpi.icon} label={kpi.label} value={kpi.value} tone={kpi.tone} />
                  ))}
                </div>
              )}

            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* ── Needs Attention ──────────────────────────────────────────────────── */}
      <Card id="needs-attention">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold">Needs Attention</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {dashLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : dashboard ? (
            <Tabs defaultValue={defaultTab}>
              <div className="overflow-x-auto -mx-1 px-1 pb-2">
                <TabsList className="h-auto flex-nowrap gap-0.5 p-1">
                  {attentionCategories.map(cat => {
                    const Icon = cat.icon;
                    return (
                      <TabsTrigger key={cat.key} value={cat.key} className="gap-1.5 shrink-0 h-7 text-xs px-2.5">
                        <Icon className="h-3 w-3" />
                        {cat.short}
                        {cat.items.length > 0 && (
                          <Badge variant={TONE_BADGE[cat.tone]} className="ml-0.5 h-4 min-w-4 px-1 text-[9px] justify-center">
                            {cat.items.length}
                          </Badge>
                        )}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>
              {attentionCategories.map(cat => (
                <TabsContent key={cat.key} value={cat.key} className="mt-1">
                  <DrillList items={cat.items} emptyLabel={cat.emptyLabel} render={cat.render} />
                </TabsContent>
              ))}
            </Tabs>
          ) : null}
        </CardContent>
      </Card>

      {/* ── Vulnerability Table ───────────────────────────────────────────────── */}
      <Card id="vulnerabilities">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">
              Vulnerabilities
              {vulnCount > 0 && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">{vulnCount} records</span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <ExportButton
                data={(vulnerabilities ?? []) as unknown as Record<string, unknown>[]}
                columns={VULN_EXPORT_COLS}
                filename="vulnerabilities"
                title="Vulnerability Log"
              />
              <Button size="sm" onClick={openCreate} className="h-8 text-xs gap-1.5">
                <Plus className="h-3.5 w-3.5" />Log Vulnerability
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-3">
          {vulnsLoading ? (
            <div className="space-y-2 px-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : vulnerabilities && vulnerabilities.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <Table className="min-w-[640px]">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs font-medium h-8 pl-4">Finding</TableHead>
                      <TableHead className="text-xs font-medium h-8 w-24">Severity</TableHead>
                      <TableHead className="text-xs font-medium h-8">Application</TableHead>
                      <TableHead className="text-xs font-medium h-8 w-32">Status</TableHead>
                      <TableHead className="text-xs font-medium h-8">Owner</TableHead>
                      <TableHead className="w-16 h-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedVulns.map((vuln) => {
                      const v = vuln as VulnRow;
                      const meta = [v.cveId, v.affectedComponent].filter(Boolean).join(" · ");
                      return (
                        <TableRow key={v.id} className="group">
                          <TableCell className="py-2.5 pl-4">
                            <div className="text-sm font-medium leading-snug">{v.title}</div>
                            {meta && <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{meta}</div>}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold capitalize ${SEV_STYLES[v.severity] ?? SEV_STYLES.info}`}>
                              {v.severity}
                            </span>
                          </TableCell>
                          <TableCell className="py-2.5 text-sm text-muted-foreground">
                            {v.applicationName ?? (v.applicationId != null ? `App #${v.applicationId}` : "—")}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <Badge variant="outline" className="capitalize text-[10px] font-normal">
                              {v.status.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <OwnerBadge ownerName={v.ownerName} />
                          </TableCell>
                          <TableCell className="py-2.5">
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(v)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(v)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="px-4">
                <TablePagination page={page} totalPages={totalPages} onPageChange={setPage} startIndex={startIndex} endIndex={endIndex} total={total} />
              </div>
            </>
          ) : (
            <div className="text-center py-10 px-4">
              <Shield className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-3">No vulnerabilities recorded.</p>
              <Button size="sm" variant="outline" onClick={openCreate}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />Log First Vulnerability
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Log / Edit Sheet ──────────────────────────────────────────────────── */}
      <Sheet open={formOpen} onOpenChange={v => { if (!v) closeForm(); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-5">
            <SheetTitle>{editTarget ? "Edit Vulnerability" : "Log Vulnerability"}</SheetTitle>
          </SheetHeader>

          <div className="space-y-4">
            {errors.submit && (
              <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{errors.submit}</div>
            )}

            <Field label="Title" required error={errors.title}>
              <Input placeholder="e.g. SQL injection in login endpoint" value={form.title} onChange={set("title")} className="h-9 text-sm" />
            </Field>

            <Field label="Description">
              <Textarea placeholder="Describe the vulnerability and its impact…" value={form.description} onChange={set("description")} rows={2} className="resize-none text-sm" />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Severity" required error={errors.severity}>
                <Select value={form.severity} onValueChange={v => setForm(f => ({ ...f, severity: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Severity" /></SelectTrigger>
                  <SelectContent>{SEVERITY_OPTIONS.map(o => <SelectItem key={o} value={o} className="capitalize">{o}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Status" required error={errors.status}>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>{STATUS_OPTIONS.map(o => <SelectItem key={o} value={o} className="capitalize">{o.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Category">
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent>{CATEGORY_OPTIONS.map(o => <SelectItem key={o} value={o} className="capitalize">{o}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Owner">
                <OwnerSelectField value={form.ownerId} onValueChange={v => setForm(f => ({ ...f, ownerId: v }))} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="CVE ID">
                <Input placeholder="CVE-2024-12345" value={form.cveId} onChange={set("cveId")} className="h-9 text-sm font-mono" />
              </Field>
              <Field label="Application" error={errors.applicationId}>
                <Select value={form.applicationId} onValueChange={v => setForm(f => ({ ...f, applicationId: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select application" /></SelectTrigger>
                  <SelectContent>
                    {applications?.map(app => (
                      <SelectItem key={app.id} value={String(app.id)}>{app.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Affected Component">
                <Input placeholder="auth/login.ts" value={form.affectedComponent} onChange={set("affectedComponent")} className="h-9 text-sm font-mono" />
              </Field>
              <Field label="Assigned To">
                <Input placeholder="Engineer name" value={form.assignedTo} onChange={set("assignedTo")} className="h-9 text-sm" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Vendor">
                <Input placeholder="e.g. Microsoft" value={form.vendor} onChange={set("vendor")} className="h-9 text-sm" />
              </Field>
              <Field label="Version">
                <Input placeholder="18.2.0" value={form.version} onChange={set("version")} className="h-9 text-sm font-mono" />
              </Field>
              <Field label="Discovered At">
                <Input type="date" value={form.discoveredAt} onChange={set("discoveredAt")} className="h-9 text-sm" />
              </Field>
              {isResolved && (
                <Field label="Resolved At">
                  <Input type="date" value={form.resolvedAt} onChange={set("resolvedAt")} className="h-9 text-sm" />
                </Field>
              )}
            </div>

            <Field label="Notes">
              <Textarea placeholder="Remediation steps, additional context…" value={form.notes} onChange={set("notes")} rows={2} className="resize-none text-sm" />
            </Field>

            <div className="flex items-center gap-2 pt-1 border-t border-border/50">
              <Button size="sm" onClick={handleSubmit} disabled={isPending}>
                {isPending
                  ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />{editTarget ? "Saving…" : "Logging…"}</>
                  : editTarget ? "Save Changes" : "Log Vulnerability"}
              </Button>
              <Button size="sm" variant="ghost" disabled={isPending} onClick={closeForm}>
                Cancel
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Delete confirm ────────────────────────────────────────────────────── */}
      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={v => { if (!v) setDeleteTarget(null); }}
        entityName="vulnerability"
        itemLabel={deleteTarget?.title ?? ""}
        isPending={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
