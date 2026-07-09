import React, { useMemo, useState } from "react";
import { useSearch, useLocation } from "wouter";
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

// ── Style helpers ──────────────────────────────────────────────────────────────
const SEV_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800",
  high:     "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  medium:   "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  low:      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  info:     "bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-400 border-gray-200 dark:border-gray-700",
};

const TONE_BG:   Record<string, string> = { danger: "bg-red-50 dark:bg-red-950/30", warning: "bg-amber-50 dark:bg-amber-950/20", ok: "bg-emerald-50 dark:bg-emerald-950/20", default: "bg-muted/40" };
const TONE_TEXT: Record<string, string> = { danger: "text-destructive", warning: "text-amber-600", ok: "text-emerald-600", default: "text-foreground" };
const TONE_ICON: Record<string, string> = { danger: "text-red-500", warning: "text-amber-500", ok: "text-emerald-500", default: "text-muted-foreground" };

function toneOf(n: number, whenBad: "danger" | "warning" = "warning") { return n > 0 ? whenBad : "ok"; }

// ── Shared sub-components ──────────────────────────────────────────────────────
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
    <Badge variant={overdue || urgent ? "destructive" : "secondary"} className="font-mono text-[10px] shrink-0">
      {overdue ? `${Math.abs(days)}d overdue` : `${days}d left`}
    </Badge>
  );
}

// ── VIEW: Risk Indicators ──────────────────────────────────────────────────────
function RiskIndicatorsView() {
  const { data: summary, isLoading: summaryLoading } = useGetSecuritySummary();
  const { data: dashboard, isLoading: dashLoading }  = useGetSecurityDashboard();

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Risk Indicators</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Security posture score and key risk metrics</p>
      </div>

      {/* Score + Severity + KPI */}
      <Card>
        <CardContent className="pt-6 pb-6">
          {summaryLoading ? (
            <Skeleton className="h-28 w-full" />
          ) : summary ? (
            <div className="flex flex-col lg:flex-row gap-6">

              {/* Score ring */}
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <ScoreRing score={summary.securityScore} />
                <p className="text-xs text-muted-foreground">Security Score</p>
              </div>

              {/* Severity bars */}
              <div className="flex-1 min-w-0 lg:border-l lg:pl-6 flex flex-col justify-center space-y-3">
                {[
                  { label: "Critical", count: summary.critical, bar: "bg-red-500" },
                  { label: "High",     count: summary.high,     bar: "bg-orange-500" },
                  { label: "Medium",   count: summary.medium,   bar: "bg-amber-500" },
                  { label: "Low",      count: summary.low,      bar: "bg-blue-400" },
                ].map(({ label, count, bar }) => {
                  const tot = summary.critical + summary.high + summary.medium + summary.low;
                  const pct = tot > 0 ? Math.round((count / tot) * 100) : 0;
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
                <div className="flex gap-5 pt-2 border-t border-border/50">
                  <span className="text-xs text-muted-foreground">Open <span className="font-semibold text-foreground">{summary.open}</span></span>
                  <span className="text-xs text-muted-foreground">In Progress <span className="font-semibold text-amber-600">{summary.inProgress}</span></span>
                  <span className="text-xs text-muted-foreground">Resolved <span className="font-semibold text-emerald-600">{summary.resolved}</span></span>
                </div>
              </div>

              {/* 5×2 KPI grid */}
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
    </div>
  );
}

// ── VIEW: Needs Attention ──────────────────────────────────────────────────────
function NeedsAttentionView() {
  const { data: dashboard, isLoading } = useGetSecurityDashboard();

  const categories = useMemo(() => {
    if (!dashboard) return [];
    return [
      {
        key: "criticalVulns", label: "Apps with Critical Vulnerabilities", icon: ShieldAlert,
        tone: toneOf(dashboard.applicationsWithCriticalVulnerabilities.length, "danger"),
        items: dashboard.applicationsWithCriticalVulnerabilities,
        emptyLabel: "No apps with open critical vulnerabilities",
        render: (a: any) => (
          <div className="flex items-center justify-between gap-3 py-1.5">
            <span className="text-sm">{a.applicationName ?? `App #${a.applicationId}`}</span>
            <Badge variant="destructive" className="text-[10px] shrink-0">{a.criticalCount} critical</Badge>
          </div>
        ),
      },
      {
        key: "patches", label: "Servers Missing Patches", icon: ServerCog,
        tone: toneOf(dashboard.serversMissingPatches.length),
        items: dashboard.serversMissingPatches,
        emptyLabel: "All servers are patched",
        render: (s: any) => (
          <div className="flex items-center justify-between gap-3 py-1.5">
            <div>
              <p className="text-sm">{s.name}</p>
              <p className="text-[10px] text-muted-foreground">{s.lastPatchedAt ? `Last patched ${new Date(s.lastPatchedAt).toLocaleDateString()}` : "Never patched"}</p>
            </div>
            <Badge variant="outline" className="capitalize text-[10px] shrink-0">{s.patchStatus}</Badge>
          </div>
        ),
      },
      {
        key: "ssl", label: "SSL Certificates Expiring Soon", icon: KeyRound,
        tone: toneOf(dashboard.sslCertificatesExpiringSoon.length),
        items: dashboard.sslCertificatesExpiringSoon,
        emptyLabel: "No SSL certificates expiring soon",
        render: (d: any) => (
          <div className="flex items-center justify-between gap-3 py-1.5">
            <div>
              <p className="text-sm">{d.name}</p>
              <p className="text-[10px] text-muted-foreground">{d.sslExpiry ? new Date(d.sslExpiry).toLocaleDateString() : "No expiry set"}</p>
            </div>
            {daysRemainingBadge(d.daysRemaining)}
          </div>
        ),
      },
      {
        key: "domains", label: "Domains Expiring Soon", icon: Globe2,
        tone: toneOf(dashboard.domainsExpiringSoon.length),
        items: dashboard.domainsExpiringSoon,
        emptyLabel: "No domains expiring soon",
        render: (d: any) => (
          <div className="flex items-center justify-between gap-3 py-1.5">
            <div>
              <p className="text-sm">{d.name}</p>
              <p className="text-[10px] text-muted-foreground">{d.registrationExpiry ? new Date(d.registrationExpiry).toLocaleDateString() : "No expiry set"}</p>
            </div>
            {daysRemainingBadge(d.daysRemaining)}
          </div>
        ),
      },
      {
        key: "backups", label: "Failed Backups", icon: DatabaseBackup,
        tone: toneOf(dashboard.failedBackups.length, "danger"),
        items: dashboard.failedBackups,
        emptyLabel: "All backups completed successfully",
        render: (b: any) => (
          <div className="flex items-center justify-between gap-3 py-1.5">
            <div>
              <p className="text-sm">{b.name}</p>
              <p className="text-[10px] text-muted-foreground">{b.lastBackupAt ? new Date(b.lastBackupAt).toLocaleString() : "Never backed up"}</p>
            </div>
            <Badge variant="destructive" className="capitalize text-[10px] shrink-0">{b.lastBackupStatus}</Badge>
          </div>
        ),
      },
      {
        key: "admins", label: "Admin Users", icon: UserCog,
        tone: "default" as const,
        items: dashboard.adminUsers,
        emptyLabel: "No admin users found",
        render: (u: any) => (
          <div className="flex items-center justify-between gap-3 py-1.5">
            <div>
              <p className="text-sm">{u.name}</p>
              <p className="text-[10px] text-muted-foreground">{u.email}</p>
            </div>
            {u.department && <Badge variant="outline" className="text-[10px] shrink-0">{u.department}</Badge>}
          </div>
        ),
      },
      {
        key: "secrets", label: "Repos with Exposed Secrets", icon: LockKeyholeOpen,
        tone: toneOf(dashboard.reposWithExposedSecrets.length, "danger"),
        items: dashboard.reposWithExposedSecrets,
        emptyLabel: "No repositories with exposed secrets",
        render: (r: any) => (
          <div className="flex items-center justify-between gap-3 py-1.5">
            <p className="text-sm">{r.name}</p>
            <p className="text-[10px] text-muted-foreground shrink-0">{r.lastScannedAt ? `Scanned ${new Date(r.lastScannedAt).toLocaleDateString()}` : "Never scanned"}</p>
          </div>
        ),
      },
      {
        key: "deps", label: "Outdated Dependencies", icon: PackageX,
        tone: toneOf(dashboard.outdatedDependencies.length),
        items: dashboard.outdatedDependencies,
        emptyLabel: "All dependencies are current",
        render: (d: any) => (
          <div className="flex items-center justify-between gap-3 py-1.5">
            <div>
              <p className="text-sm">{d.name}</p>
              <p className="text-[10px] text-muted-foreground font-mono">{d.installedVersion ?? "?"} → {d.latestVersion ?? "?"}</p>
            </div>
            {d.endOfLife && <Badge variant="destructive" className="text-[10px] shrink-0">EOL</Badge>}
          </div>
        ),
      },
      {
        key: "scans", label: "Apps Not Recently Scanned", icon: ScanEye,
        tone: toneOf(dashboard.applicationsNotRecentlyScanned.length),
        items: dashboard.applicationsNotRecentlyScanned,
        emptyLabel: "All applications scanned recently",
        render: (a: any) => (
          <div className="flex items-center justify-between gap-3 py-1.5">
            <p className="text-sm">{a.name}</p>
            <p className="text-[10px] text-muted-foreground shrink-0">{a.lastSecurityScanAt ? `Scanned ${new Date(a.lastSecurityScanAt).toLocaleDateString()}` : "Never scanned"}</p>
          </div>
        ),
      },
    ];
  }, [dashboard]);

  const flagged = categories.filter(c => c.items.length > 0);
  const clear   = categories.filter(c => c.items.length === 0);

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Needs Attention</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Items requiring review or remediation</p>
        </div>
        {!isLoading && (
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant={flagged.length > 0 ? "destructive" : "outline"} className="text-xs">
              {flagged.length} area{flagged.length !== 1 ? "s" : ""} flagged
            </Badge>
            <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200">
              {clear.length} clear
            </Badge>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
        </div>
      ) : !dashboard ? null : (
        <>
          {/* Flagged cards */}
          {flagged.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {flagged.map(cat => {
                const Icon = cat.icon;
                const isDanger  = cat.tone === "danger";
                const isWarning = cat.tone === "warning";
                return (
                  <Card key={cat.key} className={`border ${isDanger ? "border-red-200 dark:border-red-800" : isWarning ? "border-amber-200 dark:border-amber-800" : "border-border"}`}>
                    <CardHeader className="pb-2 pt-4 px-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`p-1.5 rounded-md ${isDanger ? "bg-red-100 dark:bg-red-900/40" : isWarning ? "bg-amber-100 dark:bg-amber-900/40" : "bg-muted"}`}>
                            <Icon className={`h-3.5 w-3.5 ${isDanger ? "text-red-600" : isWarning ? "text-amber-600" : "text-muted-foreground"}`} />
                          </span>
                          <CardTitle className="text-sm font-medium">{cat.label}</CardTitle>
                        </div>
                        <Badge
                          variant={isDanger ? "destructive" : "secondary"}
                          className="text-[10px] font-semibold shrink-0"
                        >
                          {cat.items.length}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-3">
                      <div className="divide-y divide-border/60 max-h-52 overflow-y-auto">
                        {cat.items.map((item, i) => (
                          <div key={i}>{cat.render(item)}</div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* All-clear section */}
          {clear.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-3">
                All clear
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2">
                {clear.map(cat => {
                  const Icon = cat.icon;
                  return (
                    <div key={cat.key} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 leading-tight truncate">{cat.label}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {flagged.length === 0 && (
            <div className="flex flex-col items-center py-16 text-center">
              <CheckCircle className="h-10 w-10 text-emerald-400 mb-3" />
              <p className="text-base font-medium">Everything looks good</p>
              <p className="text-sm text-muted-foreground mt-1">No items require attention right now.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── VIEW: Vulnerabilities ──────────────────────────────────────────────────────
function VulnerabilitiesView() {
  const { data: vulnerabilities, isLoading: vulnsLoading } = useListVulnerabilities();
  const { data: applications }                             = useListApplications();
  const { mutateAsync: createVulnerability, isPending: isCreating } = useCreateVulnerability();
  const { mutateAsync: updateVulnerability, isPending: isUpdating } = useUpdateVulnerability();
  const { mutateAsync: deleteVulnerability, isPending: isDeleting } = useDeleteVulnerability();
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen]         = useState(false);
  const [editTarget, setEditTarget]     = useState<VulnRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VulnRow | null>(null);
  const [form, setForm]                 = useState({ ...EMPTY_FORM });
  const [errors, setErrors]             = useState<Record<string, string>>({});
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

  const isResolved = form.status === "resolved" || form.status === "accepted";
  const vulnCount  = vulnerabilities?.length ?? 0;

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Vulnerabilities</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Track and manage all recorded security findings</p>
      </div>

      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">
              All Vulnerabilities
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
            <div className="text-center py-12 px-4">
              <Shield className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-3">No vulnerabilities recorded.</p>
              <Button size="sm" variant="outline" onClick={openCreate}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />Log First Vulnerability
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Log / Edit Sheet */}
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
              <Button size="sm" variant="ghost" disabled={isPending} onClick={closeForm}>Cancel</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

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

// ── Root: route to the right view ─────────────────────────────────────────────
export default function Security() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const view   = params.get("view") ?? "risk-indicators";

  if (view === "needs-attention")  return <NeedsAttentionView />;
  if (view === "vulnerabilities")  return <VulnerabilitiesView />;
  return <RiskIndicatorsView />;
}
