import React, { useState } from "react";
import { ExportButton } from "@/components/export-button";
import { z } from "zod";
import { useListApplications, useCreateApplication, useUpdateApplication, useDeleteApplication, useGetApplicationDependents } from "@workspace/api-client-react";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import type { LinkedAction } from "@/components/delete-confirm-dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AppWindow, Plus, Loader2, Pencil, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { OwnerBadge } from "@/components/owner-badge";
import { OwnerSelectField } from "@/components/owner-select-field";
import { TeamSelectField } from "@/components/team-select-field";
import { TablePagination } from "@/components/table-pagination";

import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";

const appSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  classification: z.string().min(1, "Classification is required"),
  environment: z.string().min(1, "Environment is required"),
});

const STATUS_OPTIONS = ["Active", "Inactive", "Testing", "Staging", "Maintenance", "Deprecated"];
const CATEGORY_OPTIONS = ["web", "mobile", "api", "desktop", "database", "other"];
const ENV_OPTIONS = ["Production", "Staging", "Testing", "Development"];
const PRIORITY_OPTIONS = ["Critical", "High", "Medium", "Low"];
const CRITICALITY_OPTIONS = ["Critical", "High", "Medium", "Low"];
const CLASSIFICATION_OPTIONS = [
  "Web Application", "Admin Dashboard", "Mobile App", "API", "Background Service",
  "Microservice", "Internal Tool", "Public Portal", "SaaS Integration"
];

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

function SelectField({
  value, onValueChange, placeholder, options
}: { value: string; onValueChange: (v: string) => void; placeholder: string; options: string[] }) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-9">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function EnvChip({ env }: { env: string }) {
  const map: Record<string, string> = {
    Production: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50",
    Staging:    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50",
    Testing:    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/50",
    Development:"bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/50",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${map[env] ?? "bg-muted text-muted-foreground border-border"}`}>
      {env}
    </span>
  );
}

function CriticalityDot({ value }: { value?: string | null }) {
  if (!value) return null;
  const map: Record<string, string> = {
    Critical: "bg-red-500",
    High:     "bg-orange-500",
    Medium:   "bg-amber-400",
    Low:      "bg-emerald-500",
  };
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${map[value] ?? "bg-muted-foreground"}`} />
      <span className="text-xs text-muted-foreground">{value}</span>
    </span>
  );
}

const EMPTY_FORM = {
  name: "", shortName: "", description: "", category: "", classification: "",
  environment: "", status: "Active", priority: "Medium", criticality: "Medium",
  ministry: "", department: "", businessOwner: "", technicalOwner: "",
  frontend: "", backend: "", framework: "", language: "", database: "",
  serverName: "", hostingProvider: "", domain: "", currentVersion: "", tags: "", ownerId: "", teamId: ""
};

type AppRow = { id: number; name: string; shortName?: string | null; description?: string | null; category: string; classification: string; environment: string; status: string; priority?: string | null; criticality?: string | null; ministry?: string | null; department?: string | null; businessOwner?: string | null; technicalOwner?: string | null; frontend?: string | null; backend?: string | null; framework?: string | null; language?: string | null; database?: string | null; serverName?: string | null; hostingProvider?: string | null; domain?: string | null; currentVersion?: string | null; tags?: string | null; ownerId?: number | null; ownerName?: string | null; teamId?: number | null };

const APP_EXPORT_COLS = [
  { key: "name", label: "Name" },
  { key: "category", label: "Category" },
  { key: "classification", label: "Classification" },
  { key: "environment", label: "Environment" },
  { key: "status", label: "Status" },
  { key: "priority", label: "Priority" },
  { key: "criticality", label: "Criticality" },
  { key: "department", label: "Department" },
  { key: "technicalOwner", label: "Technical Owner" },
  { key: "ownerName", label: "Owner" },
  { key: "frontend", label: "Frontend" },
  { key: "backend", label: "Backend" },
  { key: "framework", label: "Framework" },
  { key: "language", label: "Language" },
  { key: "domain", label: "Domain" },
  { key: "currentVersion", label: "Version" },
];

export default function Applications() {
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const { data: applicationsPage, isLoading } = useListApplications({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  const applications = applicationsPage?.data ?? [];
  const { mutateAsync: createApplication, isPending: isCreating } = useCreateApplication();
  const { mutateAsync: updateApplication, isPending: isUpdating } = useUpdateApplication();
  const { mutateAsync: deleteApplication, isPending: isDeleting } = useDeleteApplication();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AppRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppRow | null>(null);

  const { data: dependents, isPending: isDependentsPending } = useGetApplicationDependents(
    deleteTarget?.id ?? 0,
    { query: { enabled: !!deleteTarget, queryKey: ["/api/applications", deleteTarget?.id, "dependents"] } }
  );
  const isLoadingDependents = !!deleteTarget && isDependentsPending;
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isPending = isCreating || isUpdating;
  const total = applicationsPage?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const startIndex = total === 0 ? 0 : (page - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, total);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteApplication({ id: deleteTarget.id });
      await queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      setDeleteTarget(null);
    } catch {
      // keep dialog open on failure; user can retry or cancel
    }
  };

  const handleDeleteWithLinked = async (action: LinkedAction) => {
    if (!deleteTarget) return;
    try {
      if (action.type === "cascade") {
        await deleteApplication({ id: deleteTarget.id, params: { cascade: true } });
      } else {
        await deleteApplication({ id: deleteTarget.id, params: { reassignTo: action.targetId } });
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      setDeleteTarget(null);
    } catch {
      // keep dialog open on failure; user can retry or cancel
    }
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const openCreate = () => {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM });
    setErrors({});
    setOpen(true);
  };

  const openEdit = (app: AppRow) => {
    setEditTarget(app);
    setForm({
      name: app.name ?? "",
      shortName: app.shortName ?? "",
      description: app.description ?? "",
      category: app.category ?? "",
      classification: app.classification ?? "",
      environment: app.environment ?? "",
      status: app.status ?? "Active",
      priority: app.priority ?? "Medium",
      criticality: app.criticality ?? "Medium",
      ministry: app.ministry ?? "",
      department: app.department ?? "",
      businessOwner: app.businessOwner ?? "",
      technicalOwner: app.technicalOwner ?? "",
      frontend: app.frontend ?? "",
      backend: app.backend ?? "",
      framework: app.framework ?? "",
      language: app.language ?? "",
      database: app.database ?? "",
      serverName: app.serverName ?? "",
      hostingProvider: app.hostingProvider ?? "",
      domain: app.domain ?? "",
      currentVersion: app.currentVersion ?? "",
      tags: app.tags ?? "",
      ownerId: app.ownerId?.toString() ?? "",
      teamId: app.teamId?.toString() ?? "",
    });
    setErrors({});
    setOpen(true);
  };

  const validate = (): boolean => {
    const result = appSchema.safeParse(form);
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
      name: form.name,
      shortName: form.shortName || undefined,
      description: form.description || undefined,
      category: form.category,
      classification: form.classification,
      environment: form.environment,
      status: form.status,
      priority: form.priority,
      criticality: form.criticality,
      ministry: form.ministry || undefined,
      department: form.department || undefined,
      businessOwner: form.businessOwner || undefined,
      technicalOwner: form.technicalOwner || undefined,
      frontend: form.frontend || undefined,
      backend: form.backend || undefined,
      framework: form.framework || undefined,
      language: form.language || undefined,
      database: form.database || undefined,
      serverName: form.serverName || undefined,
      hostingProvider: form.hostingProvider || undefined,
      domain: form.domain || undefined,
      currentVersion: form.currentVersion || undefined,
      tags: form.tags || undefined,
      ownerId: form.ownerId ? Number(form.ownerId) : null,
      teamId: form.teamId ? Number(form.teamId) : null,
    };
    try {
      if (editTarget) {
        await updateApplication({ id: editTarget.id, data: payload });
      } else {
        await createApplication({ data: payload });
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      setOpen(false);
      setForm({ ...EMPTY_FORM });
      setErrors({});
    } catch {
      setErrors({ submit: `Failed to ${editTarget ? "update" : "create"} application. Please try again.` });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={AppWindow}
        iconColor="#1B56A5"
        title="Application Registry"
        subtitle="Master record for every digital application across ministries and departments"
        count={total}
        actions={
          <>
            <ExportButton data={(applications ?? []) as unknown as Record<string, unknown>[]} columns={APP_EXPORT_COLS} filename="applications" title="Application Registry" />
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />New Application</Button>
          </>
        }
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Applications</CardTitle>
          <CardDescription>Click an application name to view its full detail page</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-4 w-24 ml-auto" />
                </div>
              ))}
            </div>
          ) : applications && applications.length > 0 ? (
            <div className="overflow-x-auto -mx-6">
              <Table className="min-w-[620px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Environment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criticality</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.map((app) => (
                    <TableRow key={app.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div>
                          <Link href={`/applications/${app.id}`} className="font-semibold hover:underline text-foreground">
                            {app.name}
                          </Link>
                          {app.classification && (
                            <p className="text-xs text-muted-foreground mt-0.5">{app.classification}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell><EnvChip env={app.environment} /></TableCell>
                      <TableCell><StatusBadge status={app.status} /></TableCell>
                      <TableCell><CriticalityDot value={(app as AppRow).criticality} /></TableCell>
                      <TableCell><OwnerBadge ownerName={(app as AppRow).ownerName} /></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(app as AppRow)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(app as AppRow)}>
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
            <EmptyState
              icon={AppWindow}
              title="No applications registered"
              description="Start by registering your first application. Track its environment, status, tech stack, and ownership in one place."
              action={<Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Register First Application</Button>}
            />
          )}
          <TablePagination page={page} totalPages={totalPages} onPageChange={setPage} startIndex={startIndex} endIndex={endIndex} total={total} />
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(v) => { if (!isPending) { setOpen(v); if (!v) { setForm({ ...EMPTY_FORM }); setErrors({}); } } }}>
        <DialogContent className="max-w-2xl p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="text-lg font-semibold">
              {editTarget ? "Edit Application" : "Register New Application"}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[70vh]">
            <div className="px-6 py-5 space-y-6">
              {errors.submit && (
                <div className="text-sm text-destructive bg-destructive/10 px-4 py-2 rounded-md">
                  {errors.submit}
                </div>
              )}

              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Basic Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Application Name" required>
                    <Input placeholder="MK Citizen Portal" value={form.name} onChange={set("name")} className="h-9" />
                    {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
                  </Field>
                </div>
                <Field label="Description">
                  <Textarea placeholder="Brief description of the application's purpose..." value={form.description} onChange={set("description")} rows={2} className="resize-none" />
                </Field>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Classification</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Category" required>
                    <SelectField value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))} placeholder="Select category" options={CATEGORY_OPTIONS} />
                    {errors.category && <p className="text-xs text-destructive mt-1">{errors.category}</p>}
                  </Field>
                  <Field label="Classification" required>
                    <SelectField value={form.classification} onValueChange={v => setForm(f => ({ ...f, classification: v }))} placeholder="Select type" options={CLASSIFICATION_OPTIONS} />
                    {errors.classification && <p className="text-xs text-destructive mt-1">{errors.classification}</p>}
                  </Field>
                  <Field label="Environment" required>
                    <SelectField value={form.environment} onValueChange={v => setForm(f => ({ ...f, environment: v }))} placeholder="Select environment" options={ENV_OPTIONS} />
                    {errors.environment && <p className="text-xs text-destructive mt-1">{errors.environment}</p>}
                  </Field>
                  <Field label="Status">
                    <SelectField value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))} placeholder="Select status" options={STATUS_OPTIONS} />
                  </Field>
                  <Field label="Priority">
                    <SelectField value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))} placeholder="Select priority" options={PRIORITY_OPTIONS} />
                  </Field>
                  <Field label="Criticality">
                    <SelectField value={form.criticality} onValueChange={v => setForm(f => ({ ...f, criticality: v }))} placeholder="Select criticality" options={CRITICALITY_OPTIONS} />
                  </Field>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Ownership</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Department">
                    <Input placeholder="Platform Team" value={form.department} onChange={set("department")} className="h-9" />
                  </Field>
                  <Field label="Technical Owner">
                    <Input placeholder="Name" value={form.technicalOwner} onChange={set("technicalOwner")} className="h-9" />
                  </Field>
                  <Field label="Owner">
                    <OwnerSelectField value={form.ownerId} onValueChange={v => setForm(f => ({ ...f, ownerId: v }))} />
                  </Field>
                  <Field label="Team">
                    <TeamSelectField value={form.teamId} onValueChange={v => setForm(f => ({ ...f, teamId: v }))} />
                  </Field>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Technology Stack</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Frontend">
                    <Input placeholder="React, Vue, Angular..." value={form.frontend} onChange={set("frontend")} className="h-9" />
                  </Field>
                  <Field label="Backend">
                    <Input placeholder="Node.js, Python, Java..." value={form.backend} onChange={set("backend")} className="h-9" />
                  </Field>
                  <Field label="Framework">
                    <Input placeholder="Next.js, Django, Spring..." value={form.framework} onChange={set("framework")} className="h-9" />
                  </Field>
                  <Field label="Language">
                    <Input placeholder="TypeScript, Python, PHP..." value={form.language} onChange={set("language")} className="h-9" />
                  </Field>
                  <Field label="Database">
                    <Input placeholder="PostgreSQL, MySQL, Redis..." value={form.database} onChange={set("database")} className="h-9" />
                  </Field>
                  <Field label="Server Name">
                    <Input placeholder="prod-web-01" value={form.serverName} onChange={set("serverName")} className="h-9" />
                  </Field>
                  <Field label="Hosting Provider">
                    <Input placeholder="IONOS, AWS, On-Premise..." value={form.hostingProvider} onChange={set("hostingProvider")} className="h-9" />
                  </Field>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Deployment</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Domain">
                    <Input placeholder="app.mk.gov" value={form.domain} onChange={set("domain")} className="h-9" />
                  </Field>
                  <Field label="Current Version">
                    <Input placeholder="1.0.0" value={form.currentVersion} onChange={set("currentVersion")} className="h-9" />
                  </Field>
                </div>
                <Field label="Tags">
                  <Input placeholder="portal, citizen, public (comma separated)" value={form.tags} onChange={set("tags")} className="h-9" />
                </Field>
              </section>
            </div>
          </ScrollArea>

          <DialogFooter className="px-6 py-4 border-t gap-2">
            <Button variant="outline" onClick={() => { setOpen(false); setForm({ ...EMPTY_FORM }); setErrors({}); }} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{editTarget ? "Saving..." : "Registering..."}</> : editTarget ? "Save Changes" : "Register Application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
        entityName="application"
        itemLabel={deleteTarget?.name ?? ""}
        isPending={isDeleting}
        onConfirm={handleDelete}
        dependents={dependents}
        isLoadingDependents={!!deleteTarget && isLoadingDependents}
        linkedOptions={
          deleteTarget
            ? {
                apps: (applications as AppRow[] ?? []).filter((a) => a.id !== deleteTarget?.id),
                onConfirm: handleDeleteWithLinked,
              }
            : undefined
        }
      />
    </div>
  );
}
