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
import { Separator } from "@/components/ui/separator";
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

// ── VIEW: Security Overview (default / risk-indicators) ───────────────────────
function RiskIndicatorsView() {
  const { data: summary,         isLoading: summaryLoading } = useGetSecuritySummary();
  const { data: dashboard,       isLoading: dashLoading }    = useGetSecurityDashboard();
  const { data: vulnerabilities, isLoading: vulnsLoading }   = useListVulnerabilities();
  const [, navigate] = useLocation();

  // Needs Attention: top flagged areas sorted danger → warning
  const attentionAreas = useMemo(() => {
    if (!dashboard) return [];
    const all = [
      { label: "Apps with critical vulns",    count: dashboard.applicationsWithCriticalVulnerabilities.length, tone: toneOf(dashboard.applicationsWithCriticalVulnerabilities.length, "danger"), icon: ShieldAlert },
      { label: "Failed backups",              count: dashboard.failedBackups.length,                           tone: toneOf(dashboard.failedBackups.length, "danger"),                           icon: DatabaseBackup },
      { label: "Repos with exposed secrets",  count: dashboard.reposWithExposedSecrets.length,                 tone: toneOf(dashboard.reposWithExposedSecrets.length, "danger"),                icon: LockKeyholeOpen },
      { label: "Servers missing patches",     count: dashboard.serversMissingPatches.length,                   tone: toneOf(dashboard.serversMissingPatches.length),                            icon: ServerCog },
      { label: "SSL certs expiring",          count: dashboard.sslCertificatesExpiringSoon.length,             tone: toneOf(dashboard.sslCertificatesExpiringSoon.length),                      icon: KeyRound },
      { label: "Domains expiring",            count: dashboard.domainsExpiringSoon.length,                     tone: toneOf(dashboard.domainsExpiringSoon.length),                              icon: Globe2 },
      { label: "Outdated dependencies",       count: dashboard.outdatedDependencies.length,                    tone: toneOf(dashboard.outdatedDependencies.length),                             icon: PackageX },
      { label: "Apps not recently scanned",   count: dashboard.applicationsNotRecentlyScanned.length,          tone: toneOf(dashboard.applicationsNotRecentlyScanned.length),                   icon: ScanEye },
    ];
    const ORDER = ["danger", "warning", "default", "ok"];
    return all
      .filter(a => a.count > 0)
      .sort((a, b) => ORDER.indexOf(a.tone) - ORDER.indexOf(b.tone));
  }, [dashboard]);

  // Top vulnerabilities for summary (critical first, then high)
  const topVulns = useMemo(() => {
    if (!vulnerabilities) return [];
    const SEV_ORDER = ["critical", "high", "medium", "low", "info"];
    return [...vulnerabilities]
      .sort((a: any, b: any) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity))
      .slice(0, 5) as any[];
  }, [vulnerabilities]);

  const openCount     = (vulnerabilities ?? []).filter((v: any) => v.status === "open").length;
  const criticalCount = (vulnerabilities ?? []).filter((v: any) => v.severity === "critical" && v.status !== "resolved" && v.status !== "accepted").length;
  const highCount     = (vulnerabilities ?? []).filter((v: any) => v.severity === "high"     && v.status !== "resolved" && v.status !== "accepted").length;
  const totalFlagged  = attentionAreas.length;
  const dangerCount   = attentionAreas.filter(a => a.tone === "danger").length;

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Security</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Risk posture, operational alerts, and vulnerability status</p>
      </div>

      {/* ── Risk Indicators ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" />
            Risk Indicators
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2 pb-5">
          {summaryLoading ? (
            <Skeleton className="h-28 w-full" />
          ) : summary ? (
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <ScoreRing score={summary.securityScore} />
                <p className="text-xs text-muted-foreground">Security Score</p>
              </div>
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
              {dashLoading || !dashboard ? (
                <div className="grid grid-cols-5 gap-2 shrink-0">
                  {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-14 w-20" />)}
                </div>
              ) : (
                <div className="grid grid-cols-5 gap-2 shrink-0 lg:border-l lg:pl-6">
                  {[
                    { icon: Layers,          label: "Production", value: dashboard.systemsInProduction,                           tone: "default" },
                    { icon: ServerCog,       label: "Unpatched",  value: dashboard.serversMissingPatches.length,                  tone: toneOf(dashboard.serversMissingPatches.length) },
                    { icon: ShieldAlert,     label: "Critical",   value: dashboard.applicationsWithCriticalVulnerabilities.length, tone: toneOf(dashboard.applicationsWithCriticalVulnerabilities.length, "danger") },
                    { icon: KeyRound,        label: "SSL exp.",    value: dashboard.sslCertificatesExpiringSoon.length,            tone: toneOf(dashboard.sslCertificatesExpiringSoon.length) },
                    { icon: Globe2,          label: "Domains",    value: dashboard.domainsExpiringSoon.length,                    tone: toneOf(dashboard.domainsExpiringSoon.length) },
                    { icon: DatabaseBackup,  label: "Backups",    value: dashboard.failedBackups.length,                          tone: toneOf(dashboard.failedBackups.length, "danger") },
                    { icon: UserCog,         label: "Admins",     value: dashboard.adminUsers.length,                             tone: "default" },
                    { icon: LockKeyholeOpen, label: "Secrets",    value: dashboard.reposWithExposedSecrets.length,                tone: toneOf(dashboard.reposWithExposedSecrets.length, "danger") },
                    { icon: PackageX,        label: "Outdated",   value: dashboard.outdatedDependencies.length,                   tone: toneOf(dashboard.outdatedDependencies.length) },
                    { icon: ScanEye,         label: "Unscanned",  value: dashboard.applicationsNotRecentlyScanned.length,         tone: toneOf(dashboard.applicationsNotRecentlyScanned.length) },
                  ].map((kpi, i) => (
                    <KpiTile key={i} icon={kpi.icon} label={kpi.label} value={kpi.value} tone={kpi.tone} />
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* ── Bottom two summary cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Needs Attention summary */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" />
                Needs Attention
              </CardTitle>
              <button
                onClick={() => navigate("/security?view=needs-attention")}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View all →
              </button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {dashLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : !dashboard ? null : attentionAreas.length === 0 ? (
              <div className="flex items-center gap-2.5 py-4 text-emerald-600">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <p className="text-sm">All systems clear — nothing needs attention.</p>
              </div>
            ) : (
              <>
                {/* Summary pills */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {dangerCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-full px-2.5 py-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                      {dangerCount} critical
                    </span>
                  )}
                  {(totalFlagged - dangerCount) > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-full px-2.5 py-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      {totalFlagged - dangerCount} warning{totalFlagged - dangerCount !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                {/* Top areas */}
                <div className="space-y-1">
                  {attentionAreas.slice(0, 5).map(area => {
                    const Icon = area.icon;
                    const isDanger = area.tone === "danger";
                    return (
                      <div key={area.label} className="flex items-center gap-2.5 py-1.5">
                        <span className={`w-0.5 h-5 rounded-full shrink-0 ${isDanger ? "bg-red-500" : "bg-amber-400"}`} />
                        <Icon className={`h-3.5 w-3.5 shrink-0 ${isDanger ? "text-red-500" : "text-amber-500"}`} />
                        <span className="text-sm flex-1 min-w-0 truncate">{area.label}</span>
                        <Badge variant={isDanger ? "destructive" : "secondary"} className="text-[10px] tabular-nums shrink-0">
                          {area.count}
                        </Badge>
                      </div>
                    );
                  })}
                  {attentionAreas.length > 5 && (
                    <p className="text-xs text-muted-foreground pt-1 pl-6">
                      +{attentionAreas.length - 5} more area{attentionAreas.length - 5 !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Vulnerabilities summary */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                Vulnerabilities
              </CardTitle>
              <button
                onClick={() => navigate("/security?view=vulnerabilities")}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View all →
              </button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {vulnsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : !vulnerabilities ? null : vulnerabilities.length === 0 ? (
              <div className="flex items-center gap-2.5 py-4 text-emerald-600">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <p className="text-sm">No vulnerabilities recorded.</p>
              </div>
            ) : (
              <>
                {/* Counts row */}
                <div className="flex items-center gap-4 mb-3 pb-3 border-b border-border/50">
                  {[
                    { label: "Open",     value: openCount,     color: "text-foreground" },
                    { label: "Critical", value: criticalCount, color: "text-red-600" },
                    { label: "High",     value: highCount,     color: "text-orange-500" },
                    { label: "Total",    value: vulnerabilities.length, color: "text-muted-foreground" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="text-center">
                      <p className={`text-lg font-bold leading-none tabular-nums ${color}`}>{value}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
                {/* Top findings */}
                <div className="space-y-1">
                  {topVulns.map((v: any) => (
                    <div key={v.id} className="flex items-center gap-2.5 py-1.5">
                      <span className={`inline-flex items-center rounded border px-1.5 py-0 text-[9px] font-semibold capitalize shrink-0 ${
                        SEV_STYLES[v.severity] ?? SEV_STYLES.info
                      }`}>
                        {v.severity}
                      </span>
                      <span className="text-sm flex-1 min-w-0 truncate">{v.title}</span>
                      {v.applicationName && (
                        <span className="text-[10px] text-muted-foreground shrink-0 truncate max-w-[80px]">{v.applicationName}</span>
                      )}
                    </div>
                  ))}
                  {vulnerabilities.length > 5 && (
                    <p className="text-xs text-muted-foreground pt-1">
                      +{vulnerabilities.length - 5} more finding{vulnerabilities.length - 5 !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

// ── VIEW: Needs Attention ──────────────────────────────────────────────────────
const TONE_ACCENT: Record<string, string> = {
  danger:  "bg-red-500",
  warning: "bg-amber-400",
  default: "bg-blue-400",
  ok:      "bg-emerald-400",
};
const TONE_ICON_CLASS: Record<string, string> = {
  danger:  "text-red-500",
  warning: "text-amber-500",
  default: "text-blue-400",
  ok:      "text-emerald-500",
};
const TONE_LABEL: Record<string, string> = {
  danger:  "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  warning: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
  default: "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-300",
  ok:      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
};

// Shared row wrapper — used by list-layout categories
function AttentionRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pl-10 pr-4 py-2.5 hover:bg-muted/20 transition-colors min-h-[44px]">
      {children}
    </div>
  );
}

// Card wrapper — used by grid-layout categories
function AttentionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col justify-between rounded-lg border border-border/60 bg-background hover:bg-muted/10 transition-colors p-3.5 min-h-[86px] ${className ?? ""}`}>
      {children}
    </div>
  );
}

function NeedsAttentionView() {
  const { data: dashboard, isLoading } = useGetSecurityDashboard();

  const categories = useMemo(() => {
    if (!dashboard) return [];
    return [
      // ── Critical Vulnerabilities ──────────────────────────────────────────
      {
        key: "criticalVulns",
        label: "Apps with Critical Vulnerabilities",
        description: "Applications carrying one or more unpatched critical-severity CVEs — highest remediation priority.",
        icon: ShieldAlert,
        tone: toneOf(dashboard.applicationsWithCriticalVulnerabilities.length, "danger"),
        items: dashboard.applicationsWithCriticalVulnerabilities,
        useGrid: true,
        renderItem: (a: any) => (
          <AttentionCard className="border-l-2 border-l-red-500">
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-snug truncate">
                {a.applicationName ?? `App #${a.applicationId}`}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Application</p>
            </div>
            <div className="flex items-end justify-between mt-3">
              <span className="text-[10px] font-semibold text-red-400 dark:text-red-500 uppercase tracking-wide">critical</span>
              <span className="text-3xl font-bold text-red-600 dark:text-red-400 tabular-nums leading-none">{a.criticalCount}</span>
            </div>
          </AttentionCard>
        ),
      },
      // ── Failed Backups ────────────────────────────────────────────────────
      {
        key: "backups",
        label: "Failed Backups",
        icon: DatabaseBackup,
        tone: toneOf(dashboard.failedBackups.length, "danger"),
        items: dashboard.failedBackups,
        renderItem: (b: any) => (
          <AttentionRow>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-snug truncate">{b.name}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {b.lastBackupAt ? `Last attempt ${new Date(b.lastBackupAt).toLocaleString()}` : "Never backed up"}
              </p>
            </div>
            <Badge variant="destructive" className="capitalize text-[10px] shrink-0">{b.lastBackupStatus}</Badge>
          </AttentionRow>
        ),
      },
      // ── Exposed Secrets ───────────────────────────────────────────────────
      {
        key: "secrets",
        label: "Repos with Exposed Secrets",
        icon: LockKeyholeOpen,
        tone: toneOf(dashboard.reposWithExposedSecrets.length, "danger"),
        items: dashboard.reposWithExposedSecrets,
        renderItem: (r: any) => (
          <AttentionRow>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-snug truncate">{r.name}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {r.lastScannedAt ? `Scanned ${new Date(r.lastScannedAt).toLocaleDateString()}` : "Never scanned"}
              </p>
            </div>
            <Badge variant="destructive" className="text-[10px] shrink-0">Exposed</Badge>
          </AttentionRow>
        ),
      },
      // ── Missing Patches ───────────────────────────────────────────────────
      {
        key: "patches",
        label: "Servers Missing Patches",
        icon: ServerCog,
        tone: toneOf(dashboard.serversMissingPatches.length),
        items: dashboard.serversMissingPatches,
        renderItem: (s: any) => (
          <AttentionRow>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-snug truncate">{s.name}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {s.lastPatchedAt ? `Last patched ${new Date(s.lastPatchedAt).toLocaleDateString()}` : "Never patched"}
              </p>
            </div>
            <Badge variant="outline" className="capitalize text-[10px] shrink-0">{s.patchStatus}</Badge>
          </AttentionRow>
        ),
      },
      // ── SSL Expiry ────────────────────────────────────────────────────────
      {
        key: "ssl",
        label: "SSL Certificates Expiring Soon",
        description: "Certificates expiring within 30 days — expired SSL causes browser warnings and service disruption.",
        icon: KeyRound,
        tone: toneOf(dashboard.sslCertificatesExpiringSoon.length),
        items: dashboard.sslCertificatesExpiringSoon,
        useGrid: true,
        renderItem: (d: any) => {
          const days = d.daysRemaining as number | null;
          const overdue  = days != null && days < 0;
          const critical = days != null && !overdue && days <= 7;
          const urgent   = days != null && !overdue && !critical && days <= 14;
          const col = overdue || critical ? "text-red-600 dark:text-red-400"
                    : urgent ? "text-orange-500 dark:text-orange-400"
                    : "text-amber-500 dark:text-amber-400";
          const accent = overdue || critical ? "border-l-red-500"
                       : urgent ? "border-l-orange-400"
                       : "border-l-amber-400";
          return (
            <AttentionCard className={`border-l-2 ${accent}`}>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-snug truncate">{d.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {d.sslExpiry ? `Expires ${new Date(d.sslExpiry).toLocaleDateString()}` : "No expiry set"}
                </p>
              </div>
              <div className="flex items-end justify-between mt-3">
                <span className={`text-[10px] font-semibold uppercase tracking-wide ${col}`}>
                  {overdue ? "days over" : "days left"}
                </span>
                {days != null ? (
                  <span className={`text-3xl font-bold tabular-nums leading-none ${col}`}>{Math.abs(days)}</span>
                ) : (
                  <span className="text-xs text-muted-foreground">N/A</span>
                )}
              </div>
            </AttentionCard>
          );
        },
      },
      // ── Domains Expiring ──────────────────────────────────────────────────
      {
        key: "domains",
        label: "Domains Expiring Soon",
        icon: Globe2,
        tone: toneOf(dashboard.domainsExpiringSoon.length),
        items: dashboard.domainsExpiringSoon,
        renderItem: (d: any) => {
          const days = d.daysRemaining as number | null;
          const overdue = days != null && days < 0;
          const urgent  = days != null && !overdue && days <= 7;
          const col = overdue || urgent ? "text-red-600 dark:text-red-400" : "text-amber-500 dark:text-amber-400";
          return (
            <AttentionRow>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-snug truncate">{d.name}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {d.registrationExpiry ? `Expires ${new Date(d.registrationExpiry).toLocaleDateString()}` : "No expiry set"}
                </p>
              </div>
              {days != null ? (
                <div className="flex flex-col items-end shrink-0">
                  <span className={`text-xl font-bold tabular-nums leading-none ${col}`}>{Math.abs(days)}</span>
                  <span className={`text-[9px] font-semibold uppercase tracking-wide mt-0.5 ${col}`}>
                    {overdue ? "days over" : "days left"}
                  </span>
                </div>
              ) : (
                <Badge variant="outline" className="text-[10px] shrink-0">No expiry</Badge>
              )}
            </AttentionRow>
          );
        },
      },
      // ── Outdated Dependencies ─────────────────────────────────────────────
      {
        key: "deps",
        label: "Outdated Dependencies",
        description: "Packages with newer versions available or past end-of-life — update to reduce vulnerability surface.",
        icon: PackageX,
        tone: toneOf(dashboard.outdatedDependencies.length),
        items: dashboard.outdatedDependencies,
        useGrid: true,
        renderItem: (d: any) => (
          <AttentionCard className={d.endOfLife ? "border-l-2 border-l-red-500" : "border-l-2 border-l-amber-400"}>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-sm font-semibold leading-snug truncate">{d.name}</p>
                {d.endOfLife && (
                  <span className="shrink-0 inline-flex items-center text-[9px] font-bold uppercase tracking-wide bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 px-1.5 py-0.5 rounded">
                    EOL
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-3 flex-wrap">
              <code className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-mono">
                {d.installedVersion ?? "?"}
              </code>
              <span className="text-muted-foreground text-[10px] shrink-0">→</span>
              <code className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded font-mono">
                {d.latestVersion ?? "?"}
              </code>
            </div>
          </AttentionCard>
        ),
      },
      // ── Not Recently Scanned ──────────────────────────────────────────────
      {
        key: "scans",
        label: "Apps Not Recently Scanned",
        description: "Applications with no security scan in the past 30 days — unscanned apps may harbour undetected threats.",
        icon: ScanEye,
        tone: toneOf(dashboard.applicationsNotRecentlyScanned.length),
        items: dashboard.applicationsNotRecentlyScanned,
        useGrid: true,
        renderItem: (a: any) => {
          const daysSince = a.lastSecurityScanAt
            ? Math.floor((Date.now() - new Date(a.lastSecurityScanAt).getTime()) / 86_400_000)
            : null;
          const never    = daysSince === null;
          const critical = !never && daysSince! > 90;
          const col    = never || critical ? "text-red-600 dark:text-red-400" : "text-amber-500 dark:text-amber-400";
          const accent = never || critical ? "border-l-red-500" : "border-l-amber-400";
          return (
            <AttentionCard className={`border-l-2 ${accent}`}>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-snug truncate">{a.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {never ? "Never scanned" : `Scanned ${new Date(a.lastSecurityScanAt).toLocaleDateString()}`}
                </p>
              </div>
              <div className="flex items-end justify-between mt-3">
                <span className={`text-[10px] font-semibold uppercase tracking-wide ${col}`}>
                  {never ? "not scanned" : "days ago"}
                </span>
                {never ? (
                  <span className="text-base font-bold text-red-600 dark:text-red-400">Never</span>
                ) : (
                  <span className={`text-3xl font-bold tabular-nums leading-none ${col}`}>{daysSince}</span>
                )}
              </div>
            </AttentionCard>
          );
        },
      },
      // ── Admin Users ───────────────────────────────────────────────────────
      {
        key: "admins",
        label: "Admin Users",
        icon: UserCog,
        tone: "default" as const,
        items: dashboard.adminUsers,
        renderItem: (u: any) => (
          <AttentionRow>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-snug truncate">{u.name}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{u.email}</p>
            </div>
            {u.department && (
              <Badge variant="outline" className="text-[10px] shrink-0">{u.department}</Badge>
            )}
          </AttentionRow>
        ),
      },
    ];
  }, [dashboard]);

  const TONE_ORDER = ["danger", "warning", "default", "ok"];
  const sorted  = useMemo(
    () => [...categories].sort((a, b) => TONE_ORDER.indexOf(a.tone) - TONE_ORDER.indexOf(b.tone)),
    [categories],
  );
  const flagged = sorted.filter(c => c.items.length > 0 && c.tone !== "ok");
  const clear   = sorted.filter(c => c.items.length === 0);
  const danger  = flagged.filter(c => c.tone === "danger").length;
  const warning = flagged.filter(c => c.tone === "warning").length;

  return (
    <div className="space-y-5 max-w-3xl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Needs Attention</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Items requiring review or remediation</p>
      </div>

      {/* Summary strip */}
      {!isLoading && dashboard && (
        <div className="flex items-center gap-3 flex-wrap">
          {danger > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-full px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              {danger} critical area{danger !== 1 ? "s" : ""}
            </span>
          )}
          {warning > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-full px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              {warning} warning{warning !== 1 ? "s" : ""}
            </span>
          )}
          {flagged.length === 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-full px-3 py-1">
              <CheckCircle className="h-3 w-3" />
              All systems clear
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {clear.length} of {categories.length} areas clear
          </span>
        </div>
      )}

      {/* Body */}
      {isLoading ? (
        <Card>
          <CardContent className="py-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </CardContent>
        </Card>
      ) : !dashboard ? null : flagged.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <CheckCircle className="h-10 w-10 text-emerald-400 mb-3" />
            <p className="text-base font-medium">Everything looks good</p>
            <p className="text-sm text-muted-foreground mt-1">No items require attention right now.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {flagged.map((cat) => {
            const Icon = cat.icon;
            const isGrid = (cat as any).useGrid;
            const isDanger = cat.tone === "danger";
            return isGrid ? (
              /* ── Grid category: own card with rich header ── */
              <Card key={cat.key} className={`overflow-hidden border-t-2 ${isDanger ? "border-t-red-500" : "border-t-amber-400"}`}>
                <div className="flex items-start gap-4 px-5 pt-5 pb-4">
                  <div className={`p-3 rounded-xl shrink-0 ${TONE_LABEL[cat.tone]}`}>
                    <Icon className={`h-5 w-5 ${TONE_ICON_CLASS[cat.tone]}`} />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-start gap-2.5 flex-wrap">
                      <h3 className="text-sm font-bold tracking-tight flex-1 min-w-0 leading-tight">{cat.label}</h3>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums shrink-0 ${isDanger ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"}`}>
                        {cat.items.length}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">{(cat as any).description}</p>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3">
                  {cat.items.map((item: any, i: number) => (
                    <div key={i}>{cat.renderItem(item)}</div>
                  ))}
                </div>
              </Card>
            ) : (
              /* ── List category: own card with compact header ── */
              <Card key={cat.key} className="overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-muted/30">
                  <span className={`w-0.5 self-stretch rounded-full shrink-0 ${TONE_ACCENT[cat.tone]}`} />
                  <span className={`p-1.5 rounded-md ${TONE_LABEL[cat.tone]}`}>
                    <Icon className={`h-3.5 w-3.5 ${TONE_ICON_CLASS[cat.tone]}`} />
                  </span>
                  <span className="text-sm font-semibold flex-1 min-w-0">{cat.label}</span>
                  <Badge
                    variant={isDanger ? "destructive" : "secondary"}
                    className="shrink-0 text-[10px] font-semibold tabular-nums"
                  >
                    {cat.items.length}
                  </Badge>
                </div>
                <div className="divide-y divide-border/40">
                  {cat.items.map((item: any, i: number) => (
                    <div key={i}>{cat.renderItem(item)}</div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* All-clear footer */}
      {!isLoading && dashboard && clear.length > 0 && (
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mb-2 px-0.5">
            All clear
          </p>
          <div className="flex flex-wrap gap-2">
            {clear.map(cat => (
              <span key={cat.key} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/50 rounded-full px-2.5 py-1 border border-border/50">
                <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" />
                {cat.label}
              </span>
            ))}
          </div>
        </div>
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
