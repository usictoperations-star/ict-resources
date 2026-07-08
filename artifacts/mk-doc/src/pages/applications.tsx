import React, { useState } from "react";
import { z } from "zod";
import { useListApplications, useCreateApplication, useUpdateApplication, useDeleteApplication } from "@workspace/api-client-react";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Loader2, Pencil, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { TeamBadge } from "@/components/team-badge";
import { TeamSelectField } from "@/components/team-select-field";
import { TablePagination } from "@/components/table-pagination";
import { usePagination } from "@/hooks/use-pagination";

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

const EMPTY_FORM = {
  name: "", shortName: "", description: "", category: "", classification: "",
  environment: "", status: "Active", priority: "Medium", criticality: "Medium",
  ministry: "", department: "", businessOwner: "", technicalOwner: "",
  frontend: "", backend: "", framework: "", language: "", database: "",
  serverName: "", hostingProvider: "", domain: "", currentVersion: "", tags: "", teamId: ""
};

type AppRow = { id: number; name: string; shortName?: string | null; description?: string | null; category: string; classification: string; environment: string; status: string; priority?: string | null; criticality?: string | null; ministry?: string | null; department?: string | null; businessOwner?: string | null; technicalOwner?: string | null; frontend?: string | null; backend?: string | null; framework?: string | null; language?: string | null; database?: string | null; serverName?: string | null; hostingProvider?: string | null; domain?: string | null; currentVersion?: string | null; tags?: string | null; teamId?: number | null };

export default function Applications() {
  const { data: applications, isLoading } = useListApplications();
  const { mutateAsync: createApplication, isPending: isCreating } = useCreateApplication();
  const { mutateAsync: updateApplication, isPending: isUpdating } = useUpdateApplication();
  const { mutateAsync: deleteApplication, isPending: isDeleting } = useDeleteApplication();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AppRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppRow | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isPending = isCreating || isUpdating;
  const { page, setPage, totalPages, pageItems: pagedApplications, startIndex, endIndex, total } = usePagination(applications, 10);

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
      teamId: form.teamId ? Number(form.teamId) : undefined,
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

  const statusColor = (status?: string) => {
    if (!status) return "secondary";
    const s = status.toLowerCase();
    if (s === "active") return "default";
    if (s === "testing" || s === "staging") return "secondary";
    return "outline";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Application Registry</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Application
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Applications ({applications?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : applications && applications.length > 0 ? (
            <div className="overflow-x-auto -mx-6">
              <Table className="min-w-[500px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Environment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedApplications.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell className="font-medium">
                        <Link href={`/applications/${app.id}`} className="hover:underline text-primary">
                          {app.name}
                        </Link>
                      </TableCell>
                      <TableCell className="capitalize">{app.category}</TableCell>
                      <TableCell>{app.environment}</TableCell>
                      <TableCell>
                        <Badge variant={statusColor(app.status)}>
                          {app.status}
                        </Badge>
                      </TableCell>
                      <TableCell><TeamBadge teamId={(app as AppRow).teamId} /></TableCell>
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
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground mb-4">No applications registered yet.</p>
              <Button variant="outline" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Register First Application
              </Button>
            </div>
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
                  <Field label="Short Name / Code">
                    <Input placeholder="MK-CP" value={form.shortName} onChange={set("shortName")} className="h-9" />
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
                  <Field label="Ministry">
                    <Input placeholder="Ministry of Digital Affairs" value={form.ministry} onChange={set("ministry")} className="h-9" />
                  </Field>
                  <Field label="Department">
                    <Input placeholder="Platform Team" value={form.department} onChange={set("department")} className="h-9" />
                  </Field>
                  <Field label="Business Owner">
                    <Input placeholder="Name" value={form.businessOwner} onChange={set("businessOwner")} className="h-9" />
                  </Field>
                  <Field label="Technical Owner">
                    <Input placeholder="Name" value={form.technicalOwner} onChange={set("technicalOwner")} className="h-9" />
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
      />
    </div>
  );
}
