import React, { useState } from "react";
import { z } from "zod";
import { useListInfrastructure, useCreateInfrastructure, useUpdateInfrastructure } from "@workspace/api-client-react";
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
import { Plus, Loader2, Pencil } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const TYPE_OPTIONS = ["VPS", "Bare Metal", "Docker", "VM", "Container", "Load Balancer", "Database Server", "CDN", "Other"];
const STATUS_OPTIONS = ["active", "inactive", "maintenance", "decommissioned"];

const infraSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.string().min(1, "Type is required"),
  status: z.string().min(1, "Status is required"),
  cpuCores: z.union([z.string().regex(/^\d*$/, "Must be a whole number"), z.literal("")]).optional(),
  ramGb: z.union([z.string().regex(/^\d*$/, "Must be a whole number"), z.literal("")]).optional(),
  diskGb: z.union([z.string().regex(/^\d*$/, "Must be a whole number"), z.literal("")]).optional(),
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

const EMPTY_FORM = { name: "", type: "", provider: "", status: "active", ipAddress: "", location: "", cpuCores: "", ramGb: "", diskGb: "", os: "", notes: "" };

type InfraRow = { id: number; name: string; type: string; provider?: string | null; status: string; ipAddress?: string | null; location?: string | null; cpuCores?: number | null; ramGb?: number | null; diskGb?: number | null; os?: string | null; notes?: string | null };

export default function Infrastructure() {
  const { data: infra, isLoading } = useListInfrastructure();
  const { mutateAsync: createInfrastructure, isPending: isCreating } = useCreateInfrastructure();
  const { mutateAsync: updateInfrastructure, isPending: isUpdating } = useUpdateInfrastructure();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<InfraRow | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isPending = isCreating || isUpdating;
  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [field]: e.target.value }));

  const openCreate = () => { setEditTarget(null); setForm({ ...EMPTY_FORM }); setErrors({}); setOpen(true); };

  const openEdit = (item: InfraRow) => {
    setEditTarget(item);
    setForm({
      name: item.name ?? "", type: item.type ?? "", provider: item.provider ?? "",
      status: item.status ?? "active", ipAddress: item.ipAddress ?? "",
      location: item.location ?? "", cpuCores: item.cpuCores?.toString() ?? "",
      ramGb: item.ramGb?.toString() ?? "", diskGb: item.diskGb?.toString() ?? "",
      os: item.os ?? "", notes: item.notes ?? "",
    });
    setErrors({});
    setOpen(true);
  };

  const validate = (): boolean => {
    const result = infraSchema.safeParse(form);
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
      type: form.type,
      provider: form.provider || undefined,
      status: form.status,
      ipAddress: form.ipAddress || undefined,
      location: form.location || undefined,
      cpuCores: form.cpuCores ? Number(form.cpuCores) : undefined,
      ramGb: form.ramGb ? Number(form.ramGb) : undefined,
      diskGb: form.diskGb ? Number(form.diskGb) : undefined,
      os: form.os || undefined,
      notes: form.notes || undefined,
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

  const statusColor = (s: string) => s === "active" ? "default" : s === "maintenance" ? "secondary" : "outline";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Infrastructure Management</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />New Server</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Servers & Resources ({infra?.length ?? 0})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : infra && infra.length > 0 ? (
            <div className="overflow-x-auto -mx-6">
              <Table className="min-w-[550px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {infra.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.type}</TableCell>
                      <TableCell className="font-mono text-sm">{item.ipAddress || 'N/A'}</TableCell>
                      <TableCell><Badge variant={statusColor(item.status)}>{item.status}</Badge></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item as InfraRow)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground mb-4">No infrastructure records found.</p>
              <Button variant="outline" onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add First Server</Button>
            </div>
          )}
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
                <Field label="Name" required>
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
    </div>
  );
}
