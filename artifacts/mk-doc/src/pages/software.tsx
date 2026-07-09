import React, { useState } from "react";
import { ExportButton } from "@/components/export-button";
import { z } from "zod";
import { CreateSoftwareBody } from "@workspace/api-zod";
import { numericStringField, getFieldErrors } from "@/lib/form-validation";
import { useListSoftware, useCreateSoftware, useUpdateSoftware, useDeleteSoftware } from "@workspace/api-client-react";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import { PackageSearch, ArrowUpCircle, AlertOctagon, Plus, Loader2, Pencil, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { OwnerBadge } from "@/components/owner-badge";
import { OwnerSelectField } from "@/components/owner-select-field";
import { TablePagination } from "@/components/table-pagination";

import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

const TYPE_OPTIONS = ["framework", "library", "runtime", "database", "tool", "os", "language", "other"];

const softwareFormSchema = CreateSoftwareBody.extend({
  type: CreateSoftwareBody.shape.type.min(1, "Type is required"),
  applicationId: numericStringField(z.coerce.number({ invalid_type_error: "Must be a valid ID" }).int("Must be a valid ID").positive("Must be a valid ID")),
  ownerId: numericStringField(z.coerce.number({ invalid_type_error: "Must be a valid owner" }).int().positive()),
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

function TypeChip({ type }: { type: string }) {
  const colors: Record<string, string> = {
    framework: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/50",
    library:   "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/50",
    runtime:   "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50",
    database:  "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/50",
    tool:      "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700",
    os:        "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50",
    language:  "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800/50",
    other:     "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700",
  };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border capitalize ${colors[type] ?? "bg-muted text-muted-foreground border-border"}`}>
      {type}
    </span>
  );
}

function VersionCell({ installed, latest, upgradeAvailable }: { installed?: string | null; latest?: string | null; upgradeAvailable: boolean }) {
  return (
    <div>
      <p className="text-xs font-mono">{installed || "—"}</p>
      {upgradeAvailable && latest && (
        <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-0.5">
          <ArrowUpCircle className="h-3 w-3" />{latest}
        </p>
      )}
    </div>
  );
}

function EolCell({ endOfLife, endOfLifeDate }: { endOfLife: boolean; endOfLifeDate?: string | null }) {
  if (endOfLife) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/50">
        <AlertOctagon className="h-3 w-3" /> EOL
      </span>
    );
  }
  if (endOfLifeDate) {
    return <span className="text-xs text-muted-foreground">{new Date(endOfLifeDate).toLocaleDateString()}</span>;
  }
  return <span className="text-xs text-emerald-600 dark:text-emerald-400">Supported</span>;
}

const EMPTY_FORM = { name: "", type: "", installedVersion: "", latestVersion: "", vendor: "", license: "", supported: true, endOfLife: false, endOfLifeDate: "", upgradeAvailable: false, applicationId: "", notes: "", ownerId: "" };

type SoftwareRow = { id: number; name: string; type: string; installedVersion?: string | null; latestVersion?: string | null; vendor?: string | null; license?: string | null; supported: boolean; endOfLife: boolean; endOfLifeDate?: string | null; upgradeAvailable: boolean; applicationId?: number | null; notes?: string | null; ownerId?: number | null; ownerName?: string | null };

const SOFTWARE_EXPORT_COLS = [
  { key: "name", label: "Name" },
  { key: "type", label: "Type" },
  { key: "vendor", label: "Vendor" },
  { key: "installedVersion", label: "Installed Version" },
  { key: "latestVersion", label: "Latest Version" },
  { key: "license", label: "License" },
  { key: "supported", label: "Supported" },
  { key: "endOfLife", label: "End of Life" },
  { key: "endOfLifeDate", label: "EOL Date" },
  { key: "upgradeAvailable", label: "Upgrade Available" },
  { key: "ownerName", label: "Owner" },
];

export default function Software() {
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const { data: softwarePage, isLoading } = useListSoftware({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  const software = softwarePage?.data ?? [];
  const { mutateAsync: createSoftware, isPending: isCreating } = useCreateSoftware();
  const { mutateAsync: updateSoftware, isPending: isUpdating } = useUpdateSoftware();
  const { mutateAsync: deleteSoftware, isPending: isDeleting } = useDeleteSoftware();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SoftwareRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SoftwareRow | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isPending = isCreating || isUpdating;
  const total = softwarePage?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const startIndex = total === 0 ? 0 : (page - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, total);
  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteSoftware({ id: deleteTarget.id });
      await queryClient.invalidateQueries({ queryKey: ["/api/software"] });
      setDeleteTarget(null);
    } catch {
      // keep dialog open on failure; user can retry or cancel
    }
  };

  const openCreate = () => { setEditTarget(null); setForm({ ...EMPTY_FORM }); setErrors({}); setOpen(true); };

  const openEdit = (s: SoftwareRow) => {
    setEditTarget(s);
    setForm({
      name: s.name ?? "", type: s.type ?? "",
      installedVersion: s.installedVersion ?? "", latestVersion: s.latestVersion ?? "",
      vendor: s.vendor ?? "", license: s.license ?? "",
      supported: s.supported ?? true, endOfLife: s.endOfLife ?? false,
      endOfLifeDate: s.endOfLifeDate ? s.endOfLifeDate.substring(0, 10) : "",
      upgradeAvailable: s.upgradeAvailable ?? false,
      applicationId: s.applicationId?.toString() ?? "",
      notes: s.notes ?? "",
      ownerId: s.ownerId?.toString() ?? "",
    });
    setErrors({});
    setOpen(true);
  };

  const handleSubmit = async () => {
    const result = getFieldErrors(softwareFormSchema, form);
    if ("errors" in result) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    const parsed = result.data;
    const payload = {
      ...parsed,
      ownerId: form.ownerId ? Number(form.ownerId) : null,
    };
    try {
      if (editTarget) {
        await updateSoftware({ id: editTarget.id, data: payload });
      } else {
        await createSoftware({ data: payload });
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/software"] });
      setOpen(false);
      setForm({ ...EMPTY_FORM });
      setErrors({});
    } catch {
      setErrors({ submit: `Failed to ${editTarget ? "update" : "create"} software record.` });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={PackageSearch}
        iconColor="#059669"
        title="Software Inventory"
        subtitle="Frameworks, libraries, runtimes, and dependencies across all applications"
        count={total}
        actions={
          <>
            <ExportButton data={(software ?? []) as unknown as Record<string, unknown>[]} columns={SOFTWARE_EXPORT_COLS} filename="software-inventory" title="Software Inventory" />
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Software</Button>
          </>
        }
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Libraries & Frameworks</CardTitle>
          <CardDescription>Version tracking, EOL monitoring, and upgrade availability at a glance</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-5 w-20 rounded-md" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-16 rounded-full ml-auto" />
                </div>
              ))}
            </div>
          ) : software && software.length > 0 ? (
            <div className="overflow-x-auto -mx-6">
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>License</TableHead>
                    <TableHead>EOL</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {software.map((item) => (
                    <TableRow key={item.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div>
                          <p className="font-semibold">{item.name}</p>
                          {(item as SoftwareRow).vendor && (
                            <p className="text-xs text-muted-foreground mt-0.5">{(item as SoftwareRow).vendor}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell><TypeChip type={item.type} /></TableCell>
                      <TableCell>
                        <VersionCell
                          installed={(item as SoftwareRow).installedVersion}
                          latest={(item as SoftwareRow).latestVersion}
                          upgradeAvailable={(item as SoftwareRow).upgradeAvailable}
                        />
                      </TableCell>
                      <TableCell>
                        <span className="text-xs">{(item as SoftwareRow).license || "—"}</span>
                      </TableCell>
                      <TableCell>
                        <EolCell
                          endOfLife={(item as SoftwareRow).endOfLife}
                          endOfLifeDate={(item as SoftwareRow).endOfLifeDate}
                        />
                      </TableCell>
                      <TableCell><OwnerBadge ownerName={(item as SoftwareRow).ownerName} /></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item as SoftwareRow)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(item as SoftwareRow)}>
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
              icon={PackageSearch}
              title="No software recorded"
              description="Add your first library or framework to track versions, EOL dates, and upgrade availability."
              action={<Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add First Software</Button>}
            />
          )}
          <TablePagination page={page} totalPages={totalPages} onPageChange={setPage} startIndex={startIndex} endIndex={endIndex} total={total} />
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(v) => { if (!isPending) { setOpen(v); if (!v) { setForm({ ...EMPTY_FORM }); setErrors({}); } } }}>
        <DialogContent className="max-w-xl p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle>{editTarget ? "Edit Software" : "Add Software"}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <div className="px-6 py-5 space-y-4">
              {errors.submit && <div className="text-sm text-destructive bg-destructive/10 px-4 py-2 rounded-md">{errors.submit}</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Name" required>
                  <Input placeholder="React" value={form.name} onChange={set("name")} className="h-9" />
                  {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
                </Field>
                <Field label="Type" required>
                  <SelectField value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))} placeholder="Select type" options={TYPE_OPTIONS} />
                  {errors.type && <p className="text-xs text-destructive mt-1">{errors.type}</p>}
                </Field>
                <Field label="Installed Version">
                  <Input placeholder="18.2.0" value={form.installedVersion} onChange={set("installedVersion")} className="h-9" />
                </Field>
                <Field label="Latest Version">
                  <Input placeholder="18.3.1" value={form.latestVersion} onChange={set("latestVersion")} className="h-9" />
                </Field>
                <Field label="Vendor">
                  <Input placeholder="Meta, Microsoft..." value={form.vendor} onChange={set("vendor")} className="h-9" />
                </Field>
                <Field label="License">
                  <Input placeholder="MIT, Apache 2.0..." value={form.license} onChange={set("license")} className="h-9" />
                </Field>
                <Field label="EOL Date">
                  <Input type="date" value={form.endOfLifeDate} onChange={set("endOfLifeDate")} className="h-9" />
                </Field>
                <Field label="Application ID">
                  <Input type="number" placeholder="1" value={form.applicationId} onChange={set("applicationId")} className="h-9" />
                  {errors.applicationId && <p className="text-xs text-destructive mt-1">{errors.applicationId}</p>}
                </Field>
                <Field label="Owner">
                  <OwnerSelectField value={form.ownerId} onValueChange={v => setForm(f => ({ ...f, ownerId: v }))} />
                </Field>
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={form.supported} onCheckedChange={v => setForm(f => ({ ...f, supported: !!v }))} />
                  <span className="text-sm">Supported</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={form.endOfLife} onCheckedChange={v => setForm(f => ({ ...f, endOfLife: !!v }))} />
                  <span className="text-sm">End of Life</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={form.upgradeAvailable} onCheckedChange={v => setForm(f => ({ ...f, upgradeAvailable: !!v }))} />
                  <span className="text-sm">Upgrade Available</span>
                </label>
              </div>
              <Field label="Notes">
                <Textarea placeholder="Additional notes..." value={form.notes} onChange={set("notes")} rows={2} className="resize-none" />
              </Field>
            </div>
          </ScrollArea>
          <DialogFooter className="px-6 py-4 border-t gap-2">
            <Button variant="outline" onClick={() => { setOpen(false); setForm({ ...EMPTY_FORM }); setErrors({}); }} disabled={isPending}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{editTarget ? "Saving..." : "Adding..."}</> : editTarget ? "Save Changes" : "Add Software"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
        entityName="software record"
        itemLabel={deleteTarget?.name ?? ""}
        isPending={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
