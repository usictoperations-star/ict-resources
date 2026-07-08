import React, { useState } from "react";
import { z } from "zod";
import { useListVulnerabilities, useGetSecuritySummary, useCreateVulnerability, useUpdateVulnerability, useDeleteVulnerability } from "@workspace/api-client-react";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, ShieldAlert, CheckCircle, Clock, Plus, Loader2, Pencil, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const SEVERITY_OPTIONS = ["critical", "high", "medium", "low", "info"];
const STATUS_OPTIONS = ["open", "in_progress", "resolved", "accepted", "false_positive"];

const vulnSchema = z.object({
  title: z.string().min(1, "Title is required"),
  severity: z.string().min(1, "Severity is required"),
  status: z.string().min(1, "Status is required"),
  applicationId: z.union([z.string().regex(/^\d+$/, "Must be a valid ID"), z.literal("")]).optional(),
});

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>
      {children}
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

const EMPTY_FORM = { title: "", description: "", severity: "medium", status: "open", applicationId: "", cveId: "", affectedComponent: "", discoveredAt: "", assignedTo: "", notes: "" };

type VulnRow = { id: number; title: string; description?: string | null; severity: string; status: string; applicationId?: number | null; applicationName?: string | null; cveId?: string | null; affectedComponent?: string | null; discoveredAt?: string | null; assignedTo?: string | null; notes?: string | null };

export default function Security() {
  const { data: vulnerabilities, isLoading: vulnsLoading } = useListVulnerabilities();
  const { data: summary, isLoading: summaryLoading } = useGetSecuritySummary();
  const { mutateAsync: createVulnerability, isPending: isCreating } = useCreateVulnerability();
  const { mutateAsync: updateVulnerability, isPending: isUpdating } = useUpdateVulnerability();
  const { mutateAsync: deleteVulnerability, isPending: isDeleting } = useDeleteVulnerability();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<VulnRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VulnRow | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isPending = isCreating || isUpdating;
  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteVulnerability({ id: deleteTarget.id });
      await queryClient.invalidateQueries({ queryKey: ["/api/security/vulnerabilities"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/security/summary"] });
      setDeleteTarget(null);
    } catch {
      // keep dialog open on failure; user can retry or cancel
    }
  };

  const openCreate = () => { setEditTarget(null); setForm({ ...EMPTY_FORM }); setErrors({}); setOpen(true); };

  const openEdit = (v: VulnRow) => {
    setEditTarget(v);
    setForm({
      title: v.title ?? "", description: v.description ?? "",
      severity: v.severity ?? "medium", status: v.status ?? "open",
      applicationId: v.applicationId?.toString() ?? "", cveId: v.cveId ?? "",
      affectedComponent: v.affectedComponent ?? "",
      discoveredAt: v.discoveredAt ? v.discoveredAt.substring(0, 10) : "",
      assignedTo: v.assignedTo ?? "", notes: v.notes ?? "",
    });
    setErrors({});
    setOpen(true);
  };

  const validate = (): boolean => {
    const result = vulnSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach(issue => {
        const field = issue.path[0] as string;
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    const payload = {
      title: form.title,
      description: form.description || undefined,
      severity: form.severity,
      status: form.status,
      applicationId: form.applicationId ? Number(form.applicationId) : undefined,
      cveId: form.cveId || undefined,
      affectedComponent: form.affectedComponent || undefined,
      discoveredAt: form.discoveredAt || undefined,
      assignedTo: form.assignedTo || undefined,
      notes: form.notes || undefined,
    };
    try {
      if (editTarget) {
        await updateVulnerability({ id: editTarget.id, data: payload });
      } else {
        await createVulnerability({ data: payload });
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/security/vulnerabilities"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/security/summary"] });
      setOpen(false);
      setForm({ ...EMPTY_FORM });
      setErrors({});
    } catch {
      setErrors({ submit: `Failed to ${editTarget ? "update" : "create"} vulnerability.` });
    }
  };

  const severityVariant = (s: string) => s === "critical" || s === "high" ? "destructive" : s === "medium" ? "secondary" : "outline";

  const appLabel = (vuln: VulnRow) => vuln.applicationName ?? (vuln.applicationId != null ? `App #${vuln.applicationId}` : 'N/A');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Security Center</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Log Vulnerability</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {summaryLoading ? (
          [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full" />)
        ) : summary ? (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Security Score</CardTitle>
                <Shield className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{summary.securityScore}/100</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Critical/High</CardTitle>
                <ShieldAlert className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold text-destructive">{summary.critical + summary.high}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                <Clock className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{summary.inProgress}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Resolved</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{summary.resolved}</div></CardContent>
            </Card>
          </>
        ) : null}
      </div>

      <Card>
        <CardHeader><CardTitle>Vulnerabilities ({vulnerabilities?.length ?? 0})</CardTitle></CardHeader>
        <CardContent>
          {vulnsLoading ? (
            <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : vulnerabilities && vulnerabilities.length > 0 ? (
            <div className="overflow-x-auto -mx-6">
              <Table className="min-w-[650px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Application</TableHead>
                    <TableHead>CVE</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vulnerabilities.map((vuln) => (
                    <TableRow key={vuln.id}>
                      <TableCell className="font-medium">{vuln.title}</TableCell>
                      <TableCell><Badge variant={severityVariant(vuln.severity)}>{vuln.severity}</Badge></TableCell>
                      <TableCell>{appLabel(vuln as VulnRow)}</TableCell>
                      <TableCell className="font-mono text-xs">{vuln.cveId || 'N/A'}</TableCell>
                      <TableCell>{vuln.status}</TableCell>
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
              <Button variant="outline" onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Log First Vulnerability</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(v) => { if (!isPending) { setOpen(v); if (!v) { setForm({ ...EMPTY_FORM }); setErrors({}); } } }}>
        <DialogContent className="max-w-xl p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle>{editTarget ? "Edit Vulnerability" : "Log Vulnerability"}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <div className="px-6 py-5 space-y-4">
              {errors.submit && <div className="text-sm text-destructive bg-destructive/10 px-4 py-2 rounded-md">{errors.submit}</div>}
              <Field label="Title" required>
                <Input placeholder="SQL Injection in login endpoint" value={form.title} onChange={set("title")} className="h-9" />
                {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
              </Field>
              <Field label="Description">
                <Textarea placeholder="Describe the vulnerability..." value={form.description} onChange={set("description")} rows={2} className="resize-none" />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Severity" required>
                  <SelectField value={form.severity} onValueChange={v => setForm(f => ({ ...f, severity: v }))} placeholder="Select severity" options={SEVERITY_OPTIONS} />
                  {errors.severity && <p className="text-xs text-destructive mt-1">{errors.severity}</p>}
                </Field>
                <Field label="Status">
                  <SelectField value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))} placeholder="Select status" options={STATUS_OPTIONS} />
                </Field>
                <Field label="Application ID">
                  <Input type="number" placeholder="1" value={form.applicationId} onChange={set("applicationId")} className="h-9" />
                  {errors.applicationId && <p className="text-xs text-destructive mt-1">{errors.applicationId}</p>}
                </Field>
                <Field label="CVE ID">
                  <Input placeholder="CVE-2024-12345" value={form.cveId} onChange={set("cveId")} className="h-9" />
                </Field>
                <Field label="Affected Component">
                  <Input placeholder="auth/login.ts" value={form.affectedComponent} onChange={set("affectedComponent")} className="h-9" />
                </Field>
                <Field label="Discovered At">
                  <Input type="date" value={form.discoveredAt} onChange={set("discoveredAt")} className="h-9" />
                </Field>
                <Field label="Assigned To">
                  <Input placeholder="Engineer name" value={form.assignedTo} onChange={set("assignedTo")} className="h-9" />
                </Field>
              </div>
              <Field label="Notes">
                <Textarea placeholder="Remediation steps, context..." value={form.notes} onChange={set("notes")} rows={2} className="resize-none" />
              </Field>
            </div>
          </ScrollArea>
          <DialogFooter className="px-6 py-4 border-t gap-2">
            <Button variant="outline" onClick={() => { setOpen(false); setForm({ ...EMPTY_FORM }); setErrors({}); }} disabled={isPending}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{editTarget ? "Saving..." : "Logging..."}</> : editTarget ? "Save Changes" : "Log Vulnerability"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
