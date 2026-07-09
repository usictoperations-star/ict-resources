import React, { useState } from "react";
import { ExportButton } from "@/components/export-button";
import { z } from "zod";
import { CreateDatabaseBody } from "@workspace/api-zod";
import { numericStringField, getFieldErrors } from "@/lib/form-validation";
import { useListDatabases, useCreateDatabase, useUpdateDatabaseRecord, useDeleteDatabaseRecord, useGetDatabaseDependents } from "@workspace/api-client-react";
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
import { Database, ShieldCheck, ShieldOff, Lock, LockOpen, Plus, Loader2, Pencil, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { OwnerBadge } from "@/components/owner-badge";
import { OwnerSelectField } from "@/components/owner-select-field";
import { TablePagination } from "@/components/table-pagination";

import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";

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

function DbTypeChip({ type }: { type: string }) {
  const colors: Record<string, string> = {
    PostgreSQL:    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/50",
    MySQL:         "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/50",
    MariaDB:       "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50",
    Redis:         "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/50",
    MongoDB:       "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50",
    Elasticsearch: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-800/50",
  };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border ${colors[type] ?? "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700"}`}>
      {type}
    </span>
  );
}

const EMPTY_FORM = { name: "", type: "", version: "", server: "", sizeGb: "", owner: "", backupEnabled: true, encryptionEnabled: false, status: "active", notes: "", ownerId: "" };

type DbRow = { id: number; name: string; type: string; version?: string | null; server?: string | null; sizeGb?: number | null; owner?: string | null; backupEnabled: boolean; encryptionEnabled: boolean; status: string; notes?: string | null; ownerId?: number | null; ownerName?: string | null };

const DB_EXPORT_COLS = [
  { key: "name", label: "Name" },
  { key: "type", label: "Type" },
  { key: "version", label: "Version" },
  { key: "server", label: "Server" },
  { key: "sizeGb", label: "Size (GB)" },
  { key: "backupEnabled", label: "Backup Enabled" },
  { key: "encryptionEnabled", label: "Encryption Enabled" },
  { key: "status", label: "Status" },
  { key: "ownerName", label: "Owner" },
];

export default function Databases() {
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const { data: databasesPage, isLoading } = useListDatabases({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  const databases = databasesPage?.data ?? [];
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
  const total = databasesPage?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const startIndex = total === 0 ? 0 : (page - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, total);
  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [field]: e.target.value }));

  const { data: dependents, isLoading: isLoadingDependents } = useGetDatabaseDependents(
    deleteTarget?.id ?? 0,
    { query: { enabled: !!deleteTarget, queryKey: ["/api/databases", deleteTarget?.id, "dependents"] } }
  );

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
      ownerId: form.ownerId ? Number(form.ownerId) : null,
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

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Database}
        iconColor="#059669"
        title="Database Management"
        subtitle="Monitored databases across all environments — backup and encryption at a glance"
        count={total}
        actions={
          <>
            <ExportButton data={(databases ?? []) as unknown as Record<string, unknown>[]} columns={DB_EXPORT_COLS} filename="databases" title="Database Management" />
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />New Database</Button>
          </>
        }
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Databases</CardTitle>
          <CardDescription>PostgreSQL, MySQL, Redis, and other data stores</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-5 w-20 rounded-md" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-16 rounded-full ml-auto" />
                </div>
              ))}
            </div>
          ) : databases && databases.length > 0 ? (
            <div className="overflow-x-auto -mx-6">
              <Table className="min-w-[680px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Server</TableHead>
                    <TableHead className="text-center">Backup</TableHead>
                    <TableHead className="text-center">Encrypted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {databases.map((db) => (
                    <TableRow key={db.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div>
                          <p className="font-semibold">{db.name}</p>
                          {(db as DbRow).version && (
                            <p className="text-xs text-muted-foreground mt-0.5">v{(db as DbRow).version}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell><DbTypeChip type={db.type} /></TableCell>
                      <TableCell>
                        {db.server
                          ? <span className="font-mono text-xs">{db.server}</span>
                          : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        {(db as DbRow).backupEnabled
                          ? <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mx-auto" />
                          : <ShieldOff className="h-4 w-4 text-red-500 mx-auto" />}
                      </TableCell>
                      <TableCell className="text-center">
                        {(db as DbRow).encryptionEnabled
                          ? <Lock className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mx-auto" />
                          : <LockOpen className="h-4 w-4 text-muted-foreground/50 mx-auto" />}
                      </TableCell>
                      <TableCell><StatusBadge status={db.status} /></TableCell>
                      <TableCell><OwnerBadge ownerName={(db as DbRow).ownerName} /></TableCell>
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
            <EmptyState
              icon={Database}
              title="No databases found"
              description="Register your first database to track its type, backup status, encryption, and hosting server."
              action={<Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add First Database</Button>}
            />
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
        entityKind="database"
        itemLabel={deleteTarget?.name ?? ""}
        isPending={isDeleting}
        onConfirm={handleDelete}
        dependents={dependents}
        isLoadingDependents={isLoadingDependents}
      />
    </div>
  );
}
