import React, { useState } from "react";
import { z } from "zod";
import { CreateDatabaseBody } from "@workspace/api-zod";
import { numericStringField, getFieldErrors } from "@/lib/form-validation";
import { useListDatabases, useCreateDatabase, useUpdateDatabaseRecord, useDeleteDatabaseRecord } from "@workspace/api-client-react";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Loader2, Pencil, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { OwnerBadge } from "@/components/owner-badge";
import { OwnerSelectField } from "@/components/owner-select-field";
import { TablePagination } from "@/components/table-pagination";
import { usePagination } from "@/hooks/use-pagination";

const TYPE_OPTIONS = ["PostgreSQL", "MySQL", "MariaDB", "MSSQL", "Oracle", "MongoDB", "Redis", "Elasticsearch", "SQLite", "Other"];
const STATUS_OPTIONS = ["active", "inactive", "maintenance", "deprecated"];

const dbFormSchema = CreateDatabaseBody.extend({
  type: CreateDatabaseBody.shape.type.min(1, "Type is required"),
  status: CreateDatabaseBody.shape.status.min(1, "Status is required"),
  sizeGb: numericStringField(z.coerce.number({ invalid_type_error: "Must be a valid number" }).nonnegative("Must be a valid number")),
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

const EMPTY_FORM = { name: "", type: "", version: "", server: "", sizeGb: "", owner: "", backupEnabled: true, encryptionEnabled: false, status: "active", notes: "", ownerId: "" };

type DbRow = { id: number; name: string; type: string; version?: string | null; server?: string | null; sizeGb?: number | null; owner?: string | null; backupEnabled: boolean; encryptionEnabled: boolean; status: string; notes?: string | null; ownerId?: number | null };

export default function Databases() {
  const { data: databases, isLoading } = useListDatabases();
  const { mutateAsync: createDatabase, isPending: isCreating } = useCreateDatabase();
  const { mutateAsync: updateDatabase, isPending: isUpdating } = useUpdateDatabaseRecord();
  const { mutateAsync: deleteDatabase, isPending: isDeleting } = useDeleteDatabaseRecord();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DbRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DbRow | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isPending = isCreating || isUpdating;
  const { page, setPage, totalPages, pageItems: pagedDatabases, startIndex, endIndex, total } = usePagination(databases, 10);
  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDatabase({ id: deleteTarget.id });
      await queryClient.invalidateQueries({ queryKey: ["/api/databases"] });
      setDeleteTarget(null);
    } catch {
      // keep dialog open on failure; user can retry or cancel
    }
  };

  const openCreate = () => { setEditTarget(null); setForm({ ...EMPTY_FORM }); setErrors({}); setOpen(true); };

  const openEdit = (db: DbRow) => {
    setEditTarget(db);
    setForm({
      name: db.name ?? "", type: db.type ?? "", version: db.version ?? "",
      server: db.server ?? "", sizeGb: db.sizeGb?.toString() ?? "",
      owner: db.owner ?? "", backupEnabled: db.backupEnabled ?? true,
      encryptionEnabled: db.encryptionEnabled ?? false, status: db.status ?? "active",
      notes: db.notes ?? "",
      ownerId: db.ownerId?.toString() ?? "",
    });
    setErrors({});
    setOpen(true);
  };

  const handleSubmit = async () => {
    const result = getFieldErrors(dbFormSchema, form);
    if ("errors" in result) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    const parsed = result.data;
    const payload = {
      name: parsed.name, type: parsed.type,
      version: parsed.version || undefined,
      server: parsed.server || undefined,
      sizeGb: parsed.sizeGb,
      owner: parsed.owner || undefined,
      backupEnabled: parsed.backupEnabled,
      encryptionEnabled: parsed.encryptionEnabled,
      status: parsed.status,
      notes: parsed.notes || undefined,
      ownerId: form.ownerId ? Number(form.ownerId) : undefined,
    };
    try {
      if (editTarget) {
        await updateDatabase({ id: editTarget.id, data: payload });
      } else {
        await createDatabase({ data: payload });
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/databases"] });
      setOpen(false);
      setForm({ ...EMPTY_FORM });
      setErrors({});
    } catch {
      setErrors({ submit: `Failed to ${editTarget ? "update" : "create"} database record.` });
    }
  };

  const statusColor = (s: string) => s === "active" ? "default" : s === "maintenance" ? "secondary" : "outline";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Database Management</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />New Database</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Databases ({databases?.length ?? 0})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : databases && databases.length > 0 ? (
            <div className="overflow-x-auto -mx-6">
              <Table className="min-w-[550px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Server</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedDatabases.map((db) => (
                    <TableRow key={db.id}>
                      <TableCell className="font-medium">{db.name}</TableCell>
                      <TableCell>{db.type}</TableCell>
                      <TableCell>{db.server || 'N/A'}</TableCell>
                      <TableCell><Badge variant={statusColor(db.status)}>{db.status}</Badge></TableCell>
                      <TableCell><OwnerBadge ownerId={(db as DbRow).ownerId} /></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(db as DbRow)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(db as DbRow)}>
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
              <p className="text-sm text-muted-foreground mb-4">No databases found.</p>
              <Button variant="outline" onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add First Database</Button>
            </div>
          )}
          <TablePagination page={page} totalPages={totalPages} onPageChange={setPage} startIndex={startIndex} endIndex={endIndex} total={total} />
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(v) => { if (!isPending) { setOpen(v); if (!v) { setForm({ ...EMPTY_FORM }); setErrors({}); } } }}>
        <DialogContent className="max-w-xl p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle>{editTarget ? "Edit Database" : "Add Database"}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <div className="px-6 py-5 space-y-4">
              {errors.submit && <div className="text-sm text-destructive bg-destructive/10 px-4 py-2 rounded-md">{errors.submit}</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Name" required>
                  <Input placeholder="prod-postgres-01" value={form.name} onChange={set("name")} className="h-9" />
                  {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
                </Field>
                <Field label="Type" required>
                  <SelectField value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))} placeholder="Select type" options={TYPE_OPTIONS} />
                  {errors.type && <p className="text-xs text-destructive mt-1">{errors.type}</p>}
                </Field>
                <Field label="Version">
                  <Input placeholder="14.5" value={form.version} onChange={set("version")} className="h-9" />
                </Field>
                <Field label="Server">
                  <Input placeholder="db-server-01" value={form.server} onChange={set("server")} className="h-9" />
                </Field>
                <Field label="Size (GB)">
                  <Input type="number" placeholder="100" value={form.sizeGb} onChange={set("sizeGb")} className="h-9" />
                  {errors.sizeGb && <p className="text-xs text-destructive mt-1">{errors.sizeGb}</p>}
                </Field>
                <Field label="Owner">
                  <Input placeholder="Platform Team" value={form.owner} onChange={set("owner")} className="h-9" />
                </Field>
                <Field label="Status">
                  <SelectField value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))} placeholder="Select status" options={STATUS_OPTIONS} />
                </Field>
                <Field label="Owner">
                  <OwnerSelectField value={form.ownerId} onValueChange={v => setForm(f => ({ ...f, ownerId: v }))} />
                </Field>
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={form.backupEnabled} onCheckedChange={v => setForm(f => ({ ...f, backupEnabled: !!v }))} />
                  <span className="text-sm">Backup Enabled</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={form.encryptionEnabled} onCheckedChange={v => setForm(f => ({ ...f, encryptionEnabled: !!v }))} />
                  <span className="text-sm">Encryption Enabled</span>
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
              {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{editTarget ? "Saving..." : "Adding..."}</> : editTarget ? "Save Changes" : "Add Database"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
        entityName="database"
        itemLabel={deleteTarget?.name ?? ""}
        isPending={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
