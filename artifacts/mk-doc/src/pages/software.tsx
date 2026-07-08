import React, { useState } from "react";
import { z } from "zod";
import { CreateSoftwareBody } from "@workspace/api-zod";
import { numericStringField, getFieldErrors } from "@/lib/form-validation";
import { useListSoftware, useCreateSoftware, useUpdateSoftware, useDeleteSoftware } from "@workspace/api-client-react";
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
import { TeamBadge } from "@/components/team-badge";
import { TeamSelectField } from "@/components/team-select-field";
import { TablePagination } from "@/components/table-pagination";
import { usePagination } from "@/hooks/use-pagination";

const TYPE_OPTIONS = ["framework", "library", "runtime", "database", "tool", "os", "language", "other"];

const softwareFormSchema = CreateSoftwareBody.extend({
  type: CreateSoftwareBody.shape.type.min(1, "Type is required"),
  applicationId: numericStringField(z.coerce.number({ invalid_type_error: "Must be a valid ID" }).int("Must be a valid ID").positive("Must be a valid ID")),
  teamId: numericStringField(z.coerce.number({ invalid_type_error: "Must be a valid team" }).int().positive()),
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

const EMPTY_FORM = { name: "", type: "", installedVersion: "", latestVersion: "", vendor: "", license: "", supported: true, endOfLife: false, endOfLifeDate: "", upgradeAvailable: false, applicationId: "", notes: "", teamId: "" };

type SoftwareRow = { id: number; name: string; type: string; installedVersion?: string | null; latestVersion?: string | null; vendor?: string | null; license?: string | null; supported: boolean; endOfLife: boolean; endOfLifeDate?: string | null; upgradeAvailable: boolean; applicationId?: number | null; notes?: string | null; teamId?: number | null };

export default function Software() {
  const { data: software, isLoading } = useListSoftware();
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
  const { page, setPage, totalPages, pageItems: pagedSoftware, startIndex, endIndex, total } = usePagination(software, 10);
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
      teamId: s.teamId?.toString() ?? "",
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
      teamId: form.teamId ? Number(form.teamId) : undefined,
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Software Inventory</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Software</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Libraries & Frameworks ({software?.length ?? 0})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : software && software.length > 0 ? (
            <div className="overflow-x-auto -mx-6">
              <Table className="min-w-[650px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Installed Ver</TableHead>
                    <TableHead>Latest Ver</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>License</TableHead>
                    <TableHead>EOL</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedSoftware.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.type}</TableCell>
                      <TableCell>{item.vendor || 'N/A'}</TableCell>
                      <TableCell className="font-mono text-xs">{item.installedVersion || 'N/A'}</TableCell>
                      <TableCell className="font-mono text-xs">{item.latestVersion || 'N/A'}</TableCell>
                      <TableCell>
                        {item.upgradeAvailable ? (
                          <Badge variant="secondary">Upgrade Available</Badge>
                        ) : (
                          <Badge variant="outline">Up to date</Badge>
                        )}
                      </TableCell>
                      <TableCell>{item.license || 'N/A'}</TableCell>
                      <TableCell>
                        {item.endOfLife ? (
                          <Badge variant="destructive">EOL Reached</Badge>
                        ) : item.endOfLifeDate ? (
                          <span className="text-sm text-muted-foreground">{new Date(item.endOfLifeDate).toLocaleDateString()}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Supported</span>
                        )}
                      </TableCell>
                      <TableCell><TeamBadge teamId={(item as SoftwareRow).teamId} /></TableCell>
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
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground mb-4">No software records found.</p>
              <Button variant="outline" onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add First Software</Button>
            </div>
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
                <Field label="Team">
                  <TeamSelectField value={form.teamId} onValueChange={v => setForm(f => ({ ...f, teamId: v }))} />
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
