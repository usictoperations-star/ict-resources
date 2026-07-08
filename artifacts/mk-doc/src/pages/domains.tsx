import React, { useState } from "react";
import { z } from "zod";
import { useListDomains, useGetExpiringDomains, useCreateDomain, useUpdateDomain, useDeleteDomain } from "@workspace/api-client-react";
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
import { AlertCircle, Plus, Loader2, Pencil, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { TeamBadge } from "@/components/team-badge";
import { TeamSelectField } from "@/components/team-select-field";
import { TablePagination } from "@/components/table-pagination";
import { usePagination } from "@/hooks/use-pagination";

const STATUS_OPTIONS = ["active", "inactive", "expired", "pending"];
const SSL_STATUS_OPTIONS = ["valid", "expiring", "expired", "none"];

const domainSchema = z.object({
  name: z.string().min(1, "Domain name is required"),
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

const EMPTY_FORM = { name: "", registrar: "", registrationExpiry: "", sslProvider: "", sslExpiry: "", sslStatus: "valid", dnsProvider: "", cloudflarEnabled: false, status: "active", notes: "", teamId: "" };

type DomainRow = { id: number; name: string; registrar?: string | null; registrationExpiry?: string | null; sslProvider?: string | null; sslExpiry?: string | null; sslStatus: string; dnsProvider?: string | null; cloudflarEnabled: boolean; status: string; notes?: string | null; teamId?: number | null };

export default function Domains() {
  const { data: domains, isLoading: domainsLoading } = useListDomains();
  const { data: expiringDomains, isLoading: expiringLoading } = useGetExpiringDomains();
  const { mutateAsync: createDomain, isPending: isCreating } = useCreateDomain();
  const { mutateAsync: updateDomain, isPending: isUpdating } = useUpdateDomain();
  const { mutateAsync: deleteDomain, isPending: isDeleting } = useDeleteDomain();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DomainRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DomainRow | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isPending = isCreating || isUpdating;
  const { page, setPage, totalPages, pageItems: pagedDomains, startIndex, endIndex, total } = usePagination(domains, 10);
  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDomain({ id: deleteTarget.id });
      await queryClient.invalidateQueries({ queryKey: ["/api/domains"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/domains/expiring"] });
      setDeleteTarget(null);
    } catch {
      // keep dialog open on failure; user can retry or cancel
    }
  };

  const openCreate = () => { setEditTarget(null); setForm({ ...EMPTY_FORM }); setErrors({}); setOpen(true); };

  const openEdit = (d: DomainRow) => {
    setEditTarget(d);
    setForm({
      name: d.name ?? "", registrar: d.registrar ?? "",
      registrationExpiry: d.registrationExpiry ? d.registrationExpiry.substring(0, 10) : "",
      sslProvider: d.sslProvider ?? "",
      sslExpiry: d.sslExpiry ? d.sslExpiry.substring(0, 10) : "",
      sslStatus: d.sslStatus ?? "valid", dnsProvider: d.dnsProvider ?? "",
      cloudflarEnabled: d.cloudflarEnabled ?? false, status: d.status ?? "active",
      notes: d.notes ?? "",
      teamId: d.teamId?.toString() ?? "",
    });
    setErrors({});
    setOpen(true);
  };

  const validate = (): boolean => {
    const result = domainSchema.safeParse(form);
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
      registrar: form.registrar || undefined,
      registrationExpiry: form.registrationExpiry || undefined,
      sslProvider: form.sslProvider || undefined,
      sslExpiry: form.sslExpiry || undefined,
      sslStatus: form.sslStatus || undefined,
      dnsProvider: form.dnsProvider || undefined,
      cloudflarEnabled: form.cloudflarEnabled,
      status: form.status,
      notes: form.notes || undefined,
      teamId: form.teamId ? Number(form.teamId) : undefined,
    };
    try {
      if (editTarget) {
        await updateDomain({ id: editTarget.id, data: payload });
      } else {
        await createDomain({ data: payload });
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/domains"] });
      setOpen(false);
      setForm({ ...EMPTY_FORM });
      setErrors({});
    } catch {
      setErrors({ submit: `Failed to ${editTarget ? "update" : "create"} domain.` });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Domain & SSL Management</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />New Domain</Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1 border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center text-destructive">
              <AlertCircle className="w-5 h-5 mr-2" />Expiring Soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expiringLoading ? (
              <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : expiringDomains && expiringDomains.length > 0 ? (
              <div className="space-y-4">
                {expiringDomains.map(domain => (
                  <div key={domain.id} className="flex flex-col gap-1 text-sm border-b pb-2 last:border-0">
                    <div className="font-semibold">{domain.name}</div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>{domain.sslExpiry ? `SSL expires: ${new Date(domain.sslExpiry).toLocaleDateString()}` : 'No SSL info'}</span>
                      <Badge variant="destructive" className="text-[10px] h-4">Action Needed</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No domains expiring soon.</p>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader><CardTitle>All Domains ({domains?.length ?? 0})</CardTitle></CardHeader>
          <CardContent>
            {domainsLoading ? (
              <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : domains && domains.length > 0 ? (
              <div className="overflow-x-auto -mx-2">
                <Table className="min-w-[580px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Registrar</TableHead>
                      <TableHead>Reg. Expiry</TableHead>
                      <TableHead>SSL Status</TableHead>
                      <TableHead>Cloudflare</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedDomains.map((domain) => (
                      <TableRow key={domain.id}>
                        <TableCell className="font-medium">{domain.name}</TableCell>
                        <TableCell>{domain.registrar || 'N/A'}</TableCell>
                        <TableCell>{domain.registrationExpiry ? new Date(domain.registrationExpiry).toLocaleDateString() : 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant={domain.sslStatus === 'valid' ? 'default' : 'destructive'}>{domain.sslStatus}</Badge>
                        </TableCell>
                        <TableCell>{domain.cloudflarEnabled ? 'Yes' : 'No'}</TableCell>
                        <TableCell><TeamBadge teamId={(domain as DomainRow).teamId} /></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(domain as DomainRow)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(domain as DomainRow)}>
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
                <p className="text-sm text-muted-foreground mb-4">No domains found.</p>
                <Button variant="outline" onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add First Domain</Button>
              </div>
            )}
            <TablePagination page={page} totalPages={totalPages} onPageChange={setPage} startIndex={startIndex} endIndex={endIndex} total={total} />
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (!isPending) { setOpen(v); if (!v) { setForm({ ...EMPTY_FORM }); setErrors({}); } } }}>
        <DialogContent className="max-w-xl p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle>{editTarget ? "Edit Domain" : "Add Domain"}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <div className="px-6 py-5 space-y-4">
              {errors.submit && <div className="text-sm text-destructive bg-destructive/10 px-4 py-2 rounded-md">{errors.submit}</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Domain Name" required>
                  <Input placeholder="example.mk.gov" value={form.name} onChange={set("name")} className="h-9" />
                  {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
                </Field>
                <Field label="Registrar">
                  <Input placeholder="GoDaddy, Namecheap..." value={form.registrar} onChange={set("registrar")} className="h-9" />
                </Field>
                <Field label="Registration Expiry">
                  <Input type="date" value={form.registrationExpiry} onChange={set("registrationExpiry")} className="h-9" />
                </Field>
                <Field label="SSL Provider">
                  <Input placeholder="Let's Encrypt, Digicert..." value={form.sslProvider} onChange={set("sslProvider")} className="h-9" />
                </Field>
                <Field label="SSL Expiry">
                  <Input type="date" value={form.sslExpiry} onChange={set("sslExpiry")} className="h-9" />
                </Field>
                <Field label="SSL Status">
                  <SelectField value={form.sslStatus} onValueChange={v => setForm(f => ({ ...f, sslStatus: v }))} placeholder="Select SSL status" options={SSL_STATUS_OPTIONS} />
                </Field>
                <Field label="DNS Provider">
                  <Input placeholder="Cloudflare, Route 53..." value={form.dnsProvider} onChange={set("dnsProvider")} className="h-9" />
                </Field>
                <Field label="Status">
                  <SelectField value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))} placeholder="Select status" options={STATUS_OPTIONS} />
                </Field>
                <Field label="Team">
                  <TeamSelectField value={form.teamId} onValueChange={v => setForm(f => ({ ...f, teamId: v }))} />
                </Field>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={form.cloudflarEnabled} onCheckedChange={v => setForm(f => ({ ...f, cloudflarEnabled: !!v }))} />
                <span className="text-sm">Cloudflare Enabled</span>
              </label>
              <Field label="Notes">
                <Textarea placeholder="Additional notes..." value={form.notes} onChange={set("notes")} rows={2} className="resize-none" />
              </Field>
            </div>
          </ScrollArea>
          <DialogFooter className="px-6 py-4 border-t gap-2">
            <Button variant="outline" onClick={() => { setOpen(false); setForm({ ...EMPTY_FORM }); setErrors({}); }} disabled={isPending}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{editTarget ? "Saving..." : "Adding..."}</> : editTarget ? "Save Changes" : "Add Domain"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
        entityName="domain"
        itemLabel={deleteTarget?.name ?? ""}
        isPending={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
