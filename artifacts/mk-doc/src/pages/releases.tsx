import React, { useState } from "react";
import { z } from "zod";
import { useListReleases, useCreateRelease, useUpdateRelease, useDeleteRelease } from "@workspace/api-client-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Loader2, Pencil, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { TablePagination } from "@/components/table-pagination";
import { usePagination } from "@/hooks/use-pagination";

const ENV_OPTIONS = ["Production", "Staging", "Testing", "Development"];
const STATUS_OPTIONS = ["pending", "in_progress", "successful", "failed", "rolled_back"];

const createReleaseSchema = z.object({
  applicationId: z.string().min(1, "Application ID is required").regex(/^\d+$/, "Must be a valid ID"),
  version: z.string().min(1, "Version is required"),
  environment: z.string().min(1, "Environment is required"),
  status: z.string().min(1, "Status is required"),
});

const updateReleaseSchema = z.object({
  version: z.string().min(1, "Version is required"),
  environment: z.string().min(1, "Environment is required"),
  status: z.string().min(1, "Status is required"),
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

const EMPTY_FORM = { applicationId: "", version: "", environment: "Production", status: "pending", releaseDate: "", releasedBy: "", releaseNotes: "", rollbackAvailable: false, approved: false, approvedBy: "" };

type ReleaseRow = { id: number; applicationId: number; applicationName?: string | null; version: string; environment: string; status: string; releaseDate?: string | null; releasedBy?: string | null; releaseNotes?: string | null; rollbackAvailable: boolean; approved: boolean; approvedBy?: string | null };

export default function Releases() {
  const { data: releases, isLoading } = useListReleases();
  const { mutateAsync: createRelease, isPending: isCreating } = useCreateRelease();
  const { mutateAsync: updateRelease, isPending: isUpdating } = useUpdateRelease();
  const { mutateAsync: deleteRelease, isPending: isDeleting } = useDeleteRelease();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ReleaseRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ReleaseRow | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isPending = isCreating || isUpdating;
  const { page, setPage, totalPages, pageItems: pagedReleases, startIndex, endIndex, total } = usePagination(releases, 10);
  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteRelease({ id: deleteTarget.id });
      await queryClient.invalidateQueries({ queryKey: ["/api/releases"] });
      setDeleteTarget(null);
    } catch {
      // keep dialog open on failure; user can retry or cancel
    }
  };

  const openCreate = () => { setEditTarget(null); setForm({ ...EMPTY_FORM }); setErrors({}); setOpen(true); };

  const openEdit = (r: ReleaseRow) => {
    setEditTarget(r);
    setForm({
      applicationId: r.applicationId?.toString() ?? "",
      version: r.version ?? "",
      environment: r.environment ?? "Production",
      status: r.status ?? "pending",
      releaseDate: r.releaseDate ? r.releaseDate.substring(0, 16) : "",
      releasedBy: r.releasedBy ?? "",
      releaseNotes: r.releaseNotes ?? "",
      rollbackAvailable: r.rollbackAvailable ?? false,
      approved: r.approved ?? false,
      approvedBy: r.approvedBy ?? "",
    });
    setErrors({});
    setOpen(true);
  };

  const validate = (): boolean => {
    const schema = editTarget ? updateReleaseSchema : createReleaseSchema;
    const result = schema.safeParse(form);
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
    try {
      if (editTarget) {
        await updateRelease({
          id: editTarget.id, data: {
            version: form.version, environment: form.environment, status: form.status,
            releaseDate: form.releaseDate || undefined, releasedBy: form.releasedBy || undefined,
            releaseNotes: form.releaseNotes || undefined, rollbackAvailable: form.rollbackAvailable,
            approved: form.approved, approvedBy: form.approvedBy || undefined,
          }
        });
      } else {
        await createRelease({
          data: {
            applicationId: Number(form.applicationId), version: form.version,
            environment: form.environment, status: form.status,
            releaseDate: form.releaseDate || undefined, releasedBy: form.releasedBy || undefined,
            releaseNotes: form.releaseNotes || undefined, rollbackAvailable: form.rollbackAvailable,
            approved: form.approved, approvedBy: form.approvedBy || undefined,
          }
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/releases"] });
      setOpen(false);
      setForm({ ...EMPTY_FORM });
      setErrors({});
    } catch {
      setErrors({ submit: `Failed to ${editTarget ? "update" : "create"} release.` });
    }
  };

  const statusVariant = (s: string) => s === "successful" ? "default" : s === "failed" ? "destructive" : "secondary";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Release Management</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />New Release</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent Releases ({releases?.length ?? 0})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : releases && releases.length > 0 ? (
            <div className="overflow-x-auto -mx-6">
              <Table className="min-w-[680px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Application</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Environment</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Approved</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedReleases.map((release) => (
                    <TableRow key={release.id}>
                      <TableCell className="font-medium">{release.applicationName || `App #${release.applicationId}`}</TableCell>
                      <TableCell className="font-mono text-xs">{release.version}</TableCell>
                      <TableCell>{release.environment}</TableCell>
                      <TableCell>{release.releaseDate ? new Date(release.releaseDate).toLocaleString() : 'N/A'}</TableCell>
                      <TableCell><Badge variant={statusVariant(release.status)}>{release.status}</Badge></TableCell>
                      <TableCell>
                        {release.approved ? (
                          <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-200 dark:border-green-900 dark:text-green-400">Yes</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 border-yellow-200 dark:border-yellow-900 dark:text-yellow-400">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(release as ReleaseRow)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(release as ReleaseRow)}>
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
              <p className="text-sm text-muted-foreground mb-4">No releases found.</p>
              <Button variant="outline" onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Log First Release</Button>
            </div>
          )}
          <TablePagination page={page} totalPages={totalPages} onPageChange={setPage} startIndex={startIndex} endIndex={endIndex} total={total} />
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(v) => { if (!isPending) { setOpen(v); if (!v) { setForm({ ...EMPTY_FORM }); setErrors({}); } } }}>
        <DialogContent className="max-w-xl p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle>{editTarget ? "Edit Release" : "Log New Release"}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <div className="px-6 py-5 space-y-4">
              {errors.submit && <div className="text-sm text-destructive bg-destructive/10 px-4 py-2 rounded-md">{errors.submit}</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {!editTarget && (
                  <Field label="Application ID" required>
                    <Input type="number" placeholder="1" value={form.applicationId} onChange={set("applicationId")} className="h-9" />
                    {errors.applicationId && <p className="text-xs text-destructive mt-1">{errors.applicationId}</p>}
                  </Field>
                )}
                <Field label="Version" required>
                  <Input placeholder="1.2.0" value={form.version} onChange={set("version")} className="h-9" />
                  {errors.version && <p className="text-xs text-destructive mt-1">{errors.version}</p>}
                </Field>
                <Field label="Environment" required>
                  <SelectField value={form.environment} onValueChange={v => setForm(f => ({ ...f, environment: v }))} placeholder="Select environment" options={ENV_OPTIONS} />
                  {errors.environment && <p className="text-xs text-destructive mt-1">{errors.environment}</p>}
                </Field>
                <Field label="Status">
                  <SelectField value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))} placeholder="Select status" options={STATUS_OPTIONS} />
                </Field>
                <Field label="Release Date">
                  <Input type="datetime-local" value={form.releaseDate} onChange={set("releaseDate")} className="h-9" />
                </Field>
                <Field label="Released By">
                  <Input placeholder="Engineer name" value={form.releasedBy} onChange={set("releasedBy")} className="h-9" />
                </Field>
                <Field label="Approved By">
                  <Input placeholder="Approver name" value={form.approvedBy} onChange={set("approvedBy")} className="h-9" />
                </Field>
              </div>
              <Field label="Release Notes">
                <Textarea placeholder="What changed in this release..." value={form.releaseNotes} onChange={set("releaseNotes")} rows={3} className="resize-none" />
              </Field>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={form.approved} onCheckedChange={v => setForm(f => ({ ...f, approved: !!v }))} />
                  <span className="text-sm">Approved</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={form.rollbackAvailable} onCheckedChange={v => setForm(f => ({ ...f, rollbackAvailable: !!v }))} />
                  <span className="text-sm">Rollback Available</span>
                </label>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="px-6 py-4 border-t gap-2">
            <Button variant="outline" onClick={() => { setOpen(false); setForm({ ...EMPTY_FORM }); setErrors({}); }} disabled={isPending}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{editTarget ? "Saving..." : "Logging..."}</> : editTarget ? "Save Changes" : "Log Release"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
        entityName="release"
        itemLabel={deleteTarget ? `${deleteTarget.applicationName || `App #${deleteTarget.applicationId}`} v${deleteTarget.version}` : ""}
        isPending={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
