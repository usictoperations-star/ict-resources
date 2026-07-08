import React, { useMemo, useState } from "react";
import { z } from "zod";
import { useListVulnerabilities, useGetSecuritySummary, useGetSecurityDashboard, useCreateVulnerability, useUpdateVulnerability, useDeleteVulnerability } from "@workspace/api-client-react";
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
  PackageX, ScanEye, Layers, ChevronDown, ChevronRight,
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
      <Label className="text-sm font-medium">{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>
      {children}
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}

function SelectField({ value, onValueChange, placeholder, options }: { value: string; onValueChange: (v: string) => void; placeholder: string; options: string[] }) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-9"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>{options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
    </Select>
  );
}

const EMPTY_FORM = { title: "", description: "", severity: "medium", status: "open", applicationId: "", cveId: "", affectedComponent: "", version: "", vendor: "", category: "", installationDate: "", licenseType: "", licenseExpiration: "", endOfLifeDate: "", discoveredAt: "", assignedTo: "", notes: "", teamId: "" };

type VulnRow = { id: number; title: string; description?: string | null; severity: string; status: string; applicationId?: number | null; applicationName?: string | null; cveId?: string | null; affectedComponent?: string | null; version?: string | null; vendor?: string | null; category?: string | null; installationDate?: string | null; licenseType?: string | null; licenseExpiration?: string | null; endOfLifeDate?: string | null; discoveredAt?: string | null; assignedTo?: string | null; notes?: string | null; teamId?: number | null };

const TONE_TEXT: Record<string, string> = { danger: "text-destructive", warning: "text-yellow-600", ok: "text-green-600", default: "text-foreground" };
const TONE_BADGE: Record<string, "destructive" | "secondary" | "outline"> = { danger: "destructive", warning: "secondary", ok: "outline", default: "outline" };

function toneOf(count: number, dangerIfAny: "danger" | "warning" = "warning") {
  return count > 0 ? dangerIfAny : "ok";
}

function StatItem({ icon: Icon, label, value, tone = "default" }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode; tone?: "default" | "danger" | "warning" | "ok" }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-4 px-2 text-center">
      <Icon className={`h-4 w-4 ${TONE_TEXT[tone]}`} />
      <div className={`text-xl font-bold leading-none ${TONE_TEXT[tone]}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground leading-tight">{label}</div>
    </div>
  );
}

function DrillDownList({ items, emptyLabel, render }: { items: unknown[]; emptyLabel: string; render: (item: any, i: number) => React.ReactNode }) {
  if (!items || items.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">{emptyLabel}</p>;
  }
  return <ul className="divide-y">{items.map((item, i) => <li key={i} className="py-2.5 first:pt-0 last:pb-0">{render(item, i)}</li>)}</ul>;
}

function daysRemainingBadge(days?: number | null) {
  if (days == null) return null;
  return <Badge variant={days < 0 ? "destructive" : days <= 7 ? "destructive" : "secondary"}>{days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}</Badge>;
}

function Section({
  id, title, badge, badgeVariant = "outline", defaultOpen = false, children,
}: {
  id: string; title: string; badge?: React.ReactNode;
  badgeVariant?: "destructive" | "secondary" | "outline";
  defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div id={id} className="border rounded-lg bg-card shadow-sm scroll-mt-4">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-muted/40 transition-colors rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {open
            ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
          <span className="font-semibold text-sm">{title}</span>
        </div>
        {badge !== undefined && (
          <Badge variant={badgeVariant} className="shrink-0 text-[11px] h-5 px-2">{badge}</Badge>
        )}
      </button>
      {open && (
        <div className="px-5 pb-5 border-t pt-4">
          {children}
        </div>
      )}
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

  const resetCreate = () => {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM });
    setErrors({});
    setLogSectionOpen(true);
    setTimeout(() => document.getElementById("log-vulnerability")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
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
    setTimeout(() => document.getElementById("log-vulnerability")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
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
      version: form.version || undefined,
      vendor: form.vendor || undefined,
      category: form.category || undefined,
      installationDate: form.installationDate || undefined,
      licenseType: form.licenseType || undefined,
      licenseExpiration: form.licenseExpiration || undefined,
      endOfLifeDate: form.endOfLifeDate || undefined,
      discoveredAt: parsed.discoveredAt || undefined,
      assignedTo: parsed.assignedTo || undefined,
      notes: parsed.notes || undefined,
      teamId: form.teamId ? Number(form.teamId) : undefined,
    };
    try {
      if (editTarget) {
        await updateVulnerability({ id: editTarget.id, data: payload });
      } else {
        await createVulnerability({ data: payload });
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/security/vulnerabilities"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/security/summary"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/security/dashboard"] });
      setEditTarget(null);
      setForm({ ...EMPTY_FORM });
      setErrors({});
      setLogSectionOpen(false);
    } catch {
      setErrors({ submit: `Failed to ${editTarget ? "update" : "create"} vulnerability.` });
    }
  };

  const severityVariant = (s: string) => s === "critical" || s === "high" ? "destructive" : s === "medium" ? "secondary" : "outline";
  const appLabel = (vuln: VulnRow) => vuln.applicationName ?? (vuln.applicationId != null ? `App #${vuln.applicationId}` : 'N/A');
  const metaLine = (vuln: VulnRow) => {
    const parts = [vuln.cveId, vuln.version, vuln.vendor].filter(Boolean);
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
            <div>
              <p className="text-sm font-medium">{s.name}</p>
              <p className="text-xs text-muted-foreground">{s.lastPatchedAt ? `Last patched ${new Date(s.lastPatchedAt).toLocaleDateString()}` : "Never patched"}</p>
            </div>
            <Badge variant="outline" className="capitalize">{s.patchStatus}</Badge>
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
            <Badge variant="destructive">{a.criticalCount} critical</Badge>
          </div>
        ),
      },
      {
        key: "ssl", label: "SSL Certificates Expiring Soon", short: "SSL", icon: KeyRound,
        items: dashboard.sslCertificatesExpiringSoon, tone: toneOf(dashboard.sslCertificatesExpiringSoon.length),
        emptyLabel: "No SSL certificates expiring soon.",
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
        key: "domains", label: "Domains Expiring Soon", short: "Domains", icon: Globe2,
        items: dashboard.domainsExpiringSoon, tone: toneOf(dashboard.domainsExpiringSoon.length),
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
        key: "backups", label: "Failed Backups", short: "Backups", icon: DatabaseBackup,
        items: dashboard.failedBackups, tone: toneOf(dashboard.failedBackups.length, "danger"),
        emptyLabel: "All backups completed successfully.",
        render: (b: any) => (
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">{b.name}</p>
              <p className="text-xs text-muted-foreground">{b.lastBackupAt ? new Date(b.lastBackupAt).toLocaleString() : "Never backed up"}</p>
            </div>
            <Badge variant="destructive" className="capitalize">{b.lastBackupStatus}</Badge>
          </div>
        ),
      },
      {
        key: "adminUsers", label: "Admin Users", short: "Admins", icon: UserCog,
        items: dashboard.adminUsers, tone: "default" as const,
        emptyLabel: "No admin users found.",
        render: (u: any) => (
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">{u.name}</p>
              <p className="text-xs text-muted-foreground">{u.email}</p>
            </div>
            {u.department && <Badge variant="outline">{u.department}</Badge>}
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
            <div>
              <p className="text-sm font-medium">{d.name}</p>
              <p className="text-xs text-muted-foreground">{d.installedVersion ?? "?"} → {d.latestVersion ?? "?"}</p>
            </div>
            {d.endOfLife && <Badge variant="destructive">EOL</Badge>}
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
            <p className="text-xs text-muted-foreground">{a.lastSecurityScanAt ? `Last scanned ${new Date(a.lastSecurityScanAt).toLocaleDateString()}` : "Never scanned"}</p>
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
    ? dashboard.serversMissingPatches.length
    + dashboard.applicationsWithCriticalVulnerabilities.length
    + dashboard.failedBackups.length
    + dashboard.reposWithExposedSecrets.length
    : 0;
  const riskHasDanger = dashboard
    ? dashboard.applicationsWithCriticalVulnerabilities.length > 0 || dashboard.failedBackups.length > 0 || dashboard.reposWithExposedSecrets.length > 0
    : false;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Security</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Risk posture and vulnerability log.</p>
        </div>
      </div>

      {/* 1 — Vulnerability Health */}
      <Section
        id="vulnerability-health"
        title="Vulnerability Health"
        defaultOpen={true}
        badge={criticalHigh > 0 ? `${criticalHigh} Critical / High` : "All clear"}
        badgeVariant={criticalHigh > 0 ? "destructive" : "outline"}
      >
        {summaryLoading ? (
          <Skeleton className="h-28 w-full" />
        ) : summary ? (
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="flex flex-col items-center justify-center shrink-0 px-4">
              <Shield className="h-5 w-5 text-primary mb-1" />
              <div className="text-4xl font-bold leading-none">{summary.securityScore}</div>
              <div className="text-xs text-muted-foreground mt-1">Security score / 100</div>
            </div>
            <div className="grid grid-cols-3 gap-3 flex-1 w-full sm:border-l sm:pl-6">
              <StatItem icon={ShieldAlert} label="Critical / High" value={summary.critical + summary.high} tone={summary.critical + summary.high > 0 ? "danger" : "ok"} />
              <StatItem icon={Clock} label="In Progress" value={summary.inProgress} tone={summary.inProgress > 0 ? "warning" : "ok"} />
              <StatItem icon={CheckCircle} label="Resolved" value={summary.resolved} tone="ok" />
            </div>
          </div>
        ) : null}
      </Section>

      {/* 2 — Log Vulnerability (inline expandable form) */}
      <LogSection
        id="log-vulnerability"
        editTarget={editTarget}
        isOpen={logSectionOpen}
        onToggle={(v) => { setLogSectionOpen(v); if (!v) { setEditTarget(null); setForm({ ...EMPTY_FORM }); setErrors({}); } }}
      >
        <div className="space-y-4">
          {errors.submit && <div className="text-sm text-destructive bg-destructive/10 px-4 py-2 rounded-md">{errors.submit}</div>}
          {editTarget && (
            <div className="flex items-center justify-between bg-muted/50 rounded-md px-4 py-2.5">
              <p className="text-sm font-medium">Editing: <span className="text-primary">{editTarget.title}</span></p>
              <Button variant="ghost" size="sm" onClick={() => { setEditTarget(null); setForm({ ...EMPTY_FORM }); setErrors({}); }}>New entry instead</Button>
            </div>
          )}
          <Field label="Title" required error={errors.title}>
            <Input placeholder="SQL Injection in login endpoint" value={form.title} onChange={set("title")} className="h-9" />
          </Field>
          <Field label="Description">
            <Textarea placeholder="Describe the vulnerability..." value={form.description} onChange={set("description")} rows={2} className="resize-none" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Severity" required error={errors.severity}>
              <SelectField value={form.severity} onValueChange={v => setForm(f => ({ ...f, severity: v }))} placeholder="Select severity" options={SEVERITY_OPTIONS} />
            </Field>
            <Field label="Status">
              <SelectField value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))} placeholder="Select status" options={STATUS_OPTIONS} />
            </Field>
            <Field label="Application ID" error={errors.applicationId}>
              <Input type="number" placeholder="1" value={form.applicationId} onChange={set("applicationId")} className="h-9" />
            </Field>
            <Field label="CVE ID">
              <Input placeholder="CVE-2024-12345" value={form.cveId} onChange={set("cveId")} className="h-9" />
            </Field>
            <Field label="Affected Component">
              <Input placeholder="auth/login.ts" value={form.affectedComponent} onChange={set("affectedComponent")} className="h-9" />
            </Field>
            <Field label="Version">
              <Input placeholder="18.2.0" value={form.version} onChange={set("version")} className="h-9" />
            </Field>
            <Field label="Vendor">
              <Input placeholder="Meta, Microsoft..." value={form.vendor} onChange={set("vendor")} className="h-9" />
            </Field>
            <Field label="Category">
              <SelectField value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))} placeholder="Select category" options={CATEGORY_OPTIONS} />
            </Field>
            <Field label="Installation Date">
              <Input type="date" value={form.installationDate} onChange={set("installationDate")} className="h-9" />
            </Field>
            <Field label="License Type">
              <Input placeholder="MIT, Apache 2.0..." value={form.licenseType} onChange={set("licenseType")} className="h-9" />
            </Field>
            <Field label="License Expiration">
              <Input type="date" value={form.licenseExpiration} onChange={set("licenseExpiration")} className="h-9" />
            </Field>
            <Field label="End of Life Date">
              <Input type="date" value={form.endOfLifeDate} onChange={set("endOfLifeDate")} className="h-9" />
            </Field>
            <Field label="Discovered At">
              <Input type="date" value={form.discoveredAt} onChange={set("discoveredAt")} className="h-9" />
            </Field>
            <Field label="Assigned To">
              <Input placeholder="Engineer name" value={form.assignedTo} onChange={set("assignedTo")} className="h-9" />
            </Field>
            <Field label="Team">
              <TeamSelectField value={form.teamId} onValueChange={v => setForm(f => ({ ...f, teamId: v }))} />
            </Field>
          </div>
          <Field label="Notes">
            <Textarea placeholder="Remediation steps, context..." value={form.notes} onChange={set("notes")} rows={2} className="resize-none" />
          </Field>
          <div className="flex items-center gap-2 pt-1">
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{editTarget ? "Saving..." : "Logging..."}</>
                : editTarget ? "Save Changes" : "Log Vulnerability"}
            </Button>
            <Button variant="outline" disabled={isPending}
              onClick={() => { setLogSectionOpen(false); setEditTarget(null); setForm({ ...EMPTY_FORM }); setErrors({}); }}>
              Cancel
            </Button>
          </div>
        </div>
      </LogSection>

      {/* 3 — Risk Indicators */}
      <Section
        id="risk-indicators"
        title="Risk Indicators"
        defaultOpen={false}
        badge={dashboard ? (riskIssueCount > 0 ? `${riskIssueCount} issues` : "All clear") : undefined}
        badgeVariant={riskHasDanger ? "destructive" : riskIssueCount > 0 ? "secondary" : "outline"}
      >
        {dashboardLoading ? (
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : dashboard ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-y sm:divide-y-0 border rounded-lg overflow-hidden">
              <StatItem icon={Layers} label="Systems in Production" value={dashboard.systemsInProduction} />
              <StatItem icon={ServerCog} label="Servers Missing Patches" value={dashboard.serversMissingPatches.length} tone={toneOf(dashboard.serversMissingPatches.length)} />
              <StatItem icon={ShieldAlert} label="Apps w/ Critical Vulns" value={dashboard.applicationsWithCriticalVulnerabilities.length} tone={toneOf(dashboard.applicationsWithCriticalVulnerabilities.length, "danger")} />
              <StatItem icon={KeyRound} label="SSL Expiring <30d" value={dashboard.sslCertificatesExpiringSoon.length} tone={toneOf(dashboard.sslCertificatesExpiringSoon.length)} />
              <StatItem icon={Globe2} label="Domains Expiring Soon" value={dashboard.domainsExpiringSoon.length} tone={toneOf(dashboard.domainsExpiringSoon.length)} />
              <StatItem icon={DatabaseBackup} label="Failed Backups" value={dashboard.failedBackups.length} tone={toneOf(dashboard.failedBackups.length, "danger")} />
              <StatItem icon={UserCog} label="Admin Users" value={dashboard.adminUsers.length} />
              <StatItem icon={LockKeyholeOpen} label="Repos w/ Exposed Secrets" value={dashboard.reposWithExposedSecrets.length} tone={toneOf(dashboard.reposWithExposedSecrets.length, "danger")} />
              <StatItem icon={PackageX} label="Outdated Dependencies" value={dashboard.outdatedDependencies.length} tone={toneOf(dashboard.outdatedDependencies.length)} />
              <StatItem icon={ScanEye} label="Apps Not Recently Scanned" value={dashboard.applicationsNotRecentlyScanned.length} tone={toneOf(dashboard.applicationsNotRecentlyScanned.length)} />
            </div>
            <p className="text-xs text-muted-foreground pt-2">Last computed {new Date(dashboard.generatedAt).toLocaleString()}</p>
          </>
        ) : null}
      </Section>

      {/* 4 — Needs Attention */}
      <Section
        id="needs-attention"
        title="Needs Attention"
        defaultOpen={false}
        badge={dashboard ? (totalFlagged > 0 ? `${totalFlagged} flagged` : "All clear") : undefined}
        badgeVariant={totalFlagged > 0 ? "destructive" : "outline"}
      >
        {dashboardLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : dashboard ? (
          <Tabs defaultValue={defaultTab}>
            <div className="overflow-x-auto -mx-1 px-1 pb-1">
              <TabsList className="h-auto flex-nowrap">
                {attentionCategories.map(cat => (
                  <TabsTrigger key={cat.key} value={cat.key} className="gap-1.5 shrink-0">
                    <cat.icon className="h-3.5 w-3.5" />
                    <span>{cat.short}</span>
                    <Badge variant={cat.items.length > 0 ? TONE_BADGE[cat.tone] : "outline"} className="ml-0.5 h-5 min-w-5 px-1 text-[10px] justify-center">
                      {cat.items.length}
                    </Badge>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            {attentionCategories.map(cat => (
              <TabsContent key={cat.key} value={cat.key} className="mt-3">
                <p className="text-sm font-medium mb-1">{cat.label}</p>
                <DrillDownList items={cat.items} emptyLabel={cat.emptyLabel} render={cat.render} />
              </TabsContent>
            ))}
          </Tabs>
        ) : null}
      </Section>

      {/* 5 — Vulnerabilities table */}
      <Section
        id="vulnerabilities"
        title="Vulnerabilities"
        defaultOpen={true}
        badge={vulnCount > 0 ? `${vulnCount} total` : "None logged"}
        badgeVariant="outline"
      >
        <div className="flex justify-end mb-3">
          <Button size="sm" onClick={resetCreate}>
            <Plus className="h-4 w-4 mr-2" />Log Vulnerability
          </Button>
        </div>
        {vulnsLoading ? (
          <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : vulnerabilities && vulnerabilities.length > 0 ? (
          <div className="overflow-x-auto -mx-5">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Finding</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Application</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedVulnerabilities.map((vuln) => (
                  <TableRow key={vuln.id}>
                    <TableCell className="font-medium">
                      <div>{vuln.title}</div>
                      {metaLine(vuln as VulnRow) && (
                        <div className="text-xs text-muted-foreground font-normal font-mono mt-0.5">{metaLine(vuln as VulnRow)}</div>
                      )}
                    </TableCell>
                    <TableCell><Badge variant={severityVariant(vuln.severity)}>{vuln.severity}</Badge></TableCell>
                    <TableCell>{appLabel(vuln as VulnRow)}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{vuln.status.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell><TeamBadge teamId={(vuln as VulnRow).teamId} /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(vuln as VulnRow)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(vuln as VulnRow)}>
                          <Trash2 className="h-3.5 w-3.5" />
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
            <p className="text-sm text-muted-foreground mb-4">No vulnerabilities recorded.</p>
            <Button variant="outline" onClick={resetCreate}><Plus className="h-4 w-4 mr-2" />Log First Vulnerability</Button>
          </div>
        )}
        <TablePagination page={page} totalPages={totalPages} onPageChange={setPage} startIndex={startIndex} endIndex={endIndex} total={total} />
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

function LogSection({
  id, editTarget, isOpen, onToggle, children,
}: {
  id: string; editTarget: VulnRow | null; isOpen: boolean;
  onToggle: (open: boolean) => void; children: React.ReactNode;
}) {
  const title = editTarget ? "Edit Vulnerability" : "Log Vulnerability";
  const badge = editTarget ? "Editing" : undefined;
  return (
    <div id={id} className="border rounded-lg bg-card shadow-sm scroll-mt-4">
      <button
        type="button"
        onClick={() => onToggle(!isOpen)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-muted/40 transition-colors rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {isOpen
            ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
          <span className="font-semibold text-sm">{title}</span>
        </div>
        {badge && <Badge variant="secondary" className="shrink-0 text-[11px] h-5 px-2">{badge}</Badge>}
      </button>
      {isOpen && <div className="px-5 pb-5 border-t pt-4">{children}</div>}
    </div>
  );
}
