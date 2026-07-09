import React, { useState } from "react";
import { ExportButton } from "@/components/export-button";
import { z } from "zod";
import { CreateInfrastructureBody } from "@workspace/api-zod";
import { numericStringField, getFieldErrors } from "@/lib/form-validation";
import { useListInfrastructure, useCreateInfrastructure, useUpdateInfrastructure, useDeleteInfrastructure, useGetInfrastructureDependents } from "@workspace/api-client-react";
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
import { Server, Plus, Loader2, Pencil, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { OwnerBadge } from "@/components/owner-badge";
import { OwnerSelectField } from "@/components/owner-select-field";
import { TablePagination } from "@/components/table-pagination";

import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";

const TYPE_OPTIONS = ["VPS", "Bare Metal", "Docker", "VM", "Container", "Load Balancer", "Database Server", "CDN", "Other"];
const STATUS_OPTIONS = ["active", "inactive", "maintenance", "decommissioned"];

const infraFormSchema = CreateInfrastructureBody.extend({
  type: CreateInfrastructureBody.shape.type.min(1, "Type is required"),
  status: CreateInfrastructureBody.shape.status.min(1, "Status is required"),
  cpuCores: numericStringField(z.coerce.number({ invalid_type_error: "Must be a whole number" }).int("Must be a whole number").nonnegative("Must be a whole number")),
  ramGb: numericStringField(z.coerce.number({ invalid_type_error: "Must be a whole number" }).int("Must be a whole number").nonnegative("Must be a whole number")),
  diskGb: numericStringField(z.coerce.number({ invalid_type_error: "Must be a whole number" }).int("Must be a whole number").nonnegative("Must be a whole number")),
  ownerId: numericStringField(z.coerce.number({ invalid_type_error: "Must be a valid owner" }).int().positive()),
});

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

function SelectField({ value, onValueChange, placeholder, options }: { value: string; onValueChange: (v: string) => void; placeholder: string; options: string[] }) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-9"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>{options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function TypeChip({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700">
      {type}
    </span>
  );
}

function SpecsLine({ cpu, ram, disk }: { cpu?: number | null; ram?: number | null; disk?: number | null }) {
  const parts: string[] = [];
  if (cpu) parts.push(`${cpu} CPU`);
  if (ram) parts.push(`${ram} GB RAM`);
  if (disk) parts.push(`${disk} GB disk`);
  if (!parts.length) return null;
  return <span className="text-xs text-muted-foreground">{parts.join(" · ")}</span>;
}

const EMPTY_FORM = { name: "", type: "", provider: "", status: "active", ipAddress: "", location: "", cpuCores: "", ramGb: "", diskGb: "", os: "", notes: "", ownerId: "" };

type InfraRow = { id: number; name: string; type: string; provider?: string | null; status: string; ipAddress?: string | null; location?: string | null; cpuCores?: number | null; ramGb?: number | null; diskGb?: number | null; os?: string | null; notes?: string | null; ownerId?: number | null; ownerName?: string | null };

const INFRA_EXPORT_COLS = [
  { key: "name", label: "Name" },
  { key: "type", label: "Type" },
  { key: "provider", label: "Provider" },
  { key: "status", label: "Status" },
  { key: "ipAddress", label: "IP Address" },
  { key: "location", label: "Location" },
  { key: "cpuCores", label: "CPU Cores" },
  { key: "ramGb", label: "RAM (GB)" },
  { key: "diskGb", label: "Disk (GB)" },
  { key: "os", label: "OS" },
  { key: "ownerName", label: "Owner" },
];

export default function Infrastructure() {
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const { data: infraPage, isLoading } = useListInfrastructure({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  const infra = infraPage?.data ?? [];
  const { mutateAsync: createInfrastructure, isPending: isCreating } = useCreateInfrastructure();
  const { mutateAsync: updateInfrastructure, isPending: isUpdating } = useUpdateInfrastructure();
  const { mutateAsync: deleteInfrastructure, isPending: isDeleting } = useDeleteInfrastructure();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<InfraRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InfraRow | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isPending = isCreating || isUpdating;
  const total = infraPage?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const startIndex = total === 0 ? 0 : (page - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, total);
  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [field]: e.target.value }));

  const { data: dependents, isLoading: isLoadingDependents } = useGetInfrastructureDependents(
    deleteTarget?.id ?? 0,
    { query: { enabled: !!deleteTarget, queryKey: ["/api/infrastructure", deleteTarget?.id, "dependents"] } }
  );

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteInfrastructure({ id: deleteTarget.id });
      await queryClient.invalidateQueries({ queryKey: ["/api/infrastructure"] });
      setDeleteTarget(null);
    } catch {
      // keep dialog open on failure; user can retry or cancel
    }
  };

  const openCreate = () => { setEditTarget(null); setForm({ ...EMPTY_FORM }); setErrors({}); setOpen(true); };

  const openEdit = (item: InfraRow) => {
    setEditTarget(item);
    setForm({
      name: item.name ?? "", type: item.type ?? "", provider: item.provider ?? "",
      status: item.status ?? "active", ipAddress: item.ipAddress ?? "",
      location: item.location ?? "", cpuCores: item.cpuCores?.toString() ?? "",
      ramGb: item.ramGb?.toString() ?? "", diskGb: item.diskGb?.toString() ?? "",
      os: item.os ?? "", notes: item.notes ?? "",
      ownerId: item.ownerId?.toString() ?? "",
    });
    setErrors({});
    setOpen(true);
  };

  const handleSubmit = async () => {
    const result = getFieldErrors(infraFormSchema, form);
    if ("errors" in result) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    const parsed = result.data;
    const payload = {
      name: parsed.name,
      type: parsed.type,
      provider: parsed.provider || undefined,
      status: parsed.status,
      ipAddress: parsed.ipAddress || undefined,
      location: parsed.location || undefined,
      cpuCores: parsed.cpuCores,
      ramGb: parsed.ramGb,
      diskGb: parsed.diskGb,
      os: parsed.os || undefined,
      notes: parsed.notes || undefined,
      ownerId: form.ownerId ? Number(form.ownerId) : null,
    };
    try {
      if (editTarget) {
        await updateInfrastructure({ id: editTarget.id, data: payload });
      } else {
        await createInfrastructure({ data: payload });
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/infrastructure"] });
      setOpen(false);
      setForm({ ...EMPTY_FORM });
      setErrors({});
    } catch {
      setErrors({ submit: `Failed to ${editTarget ? "update" : "create"} infrastructure record.` });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Server}
        iconColor="#7C3AED"
        title="Infrastructure Management"
        subtitle="Servers, VPS, containers, and cloud resources across all environments"
        count={total}
        actions={
          <>
            <ExportButton data={(infra ?? []) as unknown as Record<string, unknown>[]} columns={INFRA_EXPORT_COLS} filename="infrastructure" title="Infrastructure Management" />
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />New Server</Button>
          </>
        }
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Servers & Resources</CardTitle>
          <CardDescription>All registered infrastructure nodes and cloud resources</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-5 w-16 rounded-md" />
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-28 ml-auto" />
                </div>
              ))}
            </div>
          ) : infra && infra.length > 0 ? (
            <div className="overflow-x-auto -mx-6">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Specs</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {infra.map((item) => (
                    <TableRow key={item.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div>
                          <p className="font-semibold">{item.name}</p>
                          {((item as InfraRow).provider || (item as InfraRow).os) && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {[(item as InfraRow).provider, (item as InfraRow).os].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell><TypeChip type={item.type} /></TableCell>
                      <TableCell>
                        <SpecsLine cpu={(item as InfraRow).cpuCores} ram={(item as InfraRow).ramGb} disk={(item as InfraRow).diskGb} />
                      </TableCell>
                      <TableCell>
                        {item.ipAddress
                          ? <span className="font-mono text-xs">{item.ipAddress}</span>
                          : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell><StatusBadge status={item.status} /></TableCell>
                      <TableCell><OwnerBadge ownerName={(item as InfraRow).ownerName} /></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item as InfraRow)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(item as InfraRow)}>
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
              icon={Server}
              title="No infrastructure recorded"
              description="Add your first server, VPS, or container to start tracking your infrastructure inventory."
              action={<Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add First Server</Button>}
            />
          )}
          <TablePagination page={page} totalPages={totalPages} onPageChange={setPage} startIndex={startIndex} endIndex={endIndex} total={total} />
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(v) => { if (!isPending) { setOpen(v); if (!v) { setForm({ ...EMPTY_FORM }); setErrors({}); } } }}>
        <DialogContent className="max-w-xl p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle>{editTarget ? "Edit Server" : "Add Infrastructure"}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <div className="px-6 py-5 space-y-4">
              {errors.submit && <div className="text-sm text-destructive bg-destructive/10 px-4 py-2 rounded-md">{errors.submit}</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Server Name" required>
                  <Input placeholder="prod-web-01" value={form.name} onChange={set("name")} className="h-9" />
                  {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
                </Field>
                <Field label="Type" required>
                  <SelectField value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))} placeholder="Select type" options={TYPE_OPTIONS} />
                  {errors.type && <p className="text-xs text-destructive mt-1">{errors.type}</p>}
                </Field>
                <Field label="Provider">
                  <Input placeholder="IONOS, AWS, Hetzner..." value={form.provider} onChange={set("provider")} className="h-9" />
                </Field>
                <Field label="Status">
                  <SelectField value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))} placeholder="Select status" options={STATUS_OPTIONS} />
                </Field>
                <Field label="IP Address">
                  <Input placeholder="192.168.1.1" value={form.ipAddress} onChange={set("ipAddress")} className="h-9" />
                </Field>
                <Field label="Location">
                  <Input placeholder="Frankfurt, DE" value={form.location} onChange={set("location")} className="h-9" />
                </Field>
                <Field label="CPU Cores">
                  <Input type="number" placeholder="4" value={form.cpuCores} onChange={set("cpuCores")} className="h-9" />
                  {errors.cpuCores && <p className="text-xs text-destructive mt-1">{errors.cpuCores}</p>}
                </Field>
                <Field label="RAM (GB)">
                  <Input type="number" placeholder="16" value={form.ramGb} onChange={set("ramGb")} className="h-9" />
                  {errors.ramGb && <p className="text-xs text-destructive mt-1">{errors.ramGb}</p>}
                </Field>
                <Field label="Disk (GB)">
                  <Input type="number" placeholder="500" value={form.diskGb} onChange={set("diskGb")} className="h-9" />
                  {errors.diskGb && <p className="text-xs text-destructive mt-1">{errors.diskGb}</p>}
                </Field>
                <Field label="OS">
                  <Input placeholder="Ubuntu 22.04 LTS" value={form.os} onChange={set("os")} className="h-9" />
                </Field>
                <Field label="Owner">
                  <OwnerSelectField value={form.ownerId} onValueChange={v => setForm(f => ({ ...f, ownerId: v }))} />
                </Field>
              </div>
              <Field label="Notes">
                <Textarea placeholder="Additional notes..." value={form.notes} onChange={set("notes")} rows={2} className="resize-none" />
              </Field>
            </div>
          </ScrollArea>
          <DialogFooter className="px-6 py-4 border-t gap-2">
            <Button variant="outline" onClick={() => { setOpen(false); setForm({ ...EMPTY_FORM }); setErrors({}); }} disabled={isPending}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{editTarget ? "Saving..." : "Adding..."}</> : editTarget ? "Save Changes" : "Add Server"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
        entityName="server"
        entityKind="server"
        itemLabel={deleteTarget?.name ?? ""}
        isPending={isDeleting}
        onConfirm={handleDelete}
        dependents={dependents}
        isLoadingDependents={isLoadingDependents}
      />
    </div>
  );
}
