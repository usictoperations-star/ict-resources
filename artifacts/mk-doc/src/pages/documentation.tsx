import React, { useState } from "react";
import { z } from "zod";
import { useListDocuments, useCreateDocument, useUpdateDocument, useDeleteDocument } from "@workspace/api-client-react";
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
import { FileText, ExternalLink, Plus, Loader2, Pencil, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const TYPE_OPTIONS = ["PRD", "TRD", "SOP", "ERD", "API", "Architecture", "Runbook", "Guide", "Policy", "Other"];

const documentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  type: z.string().min(1, "Type is required"),
  applicationId: z.union([z.string().regex(/^\d+$/, "Must be a valid ID"), z.literal("")]).optional(),
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

const EMPTY_FORM = { title: "", type: "", content: "", url: "", applicationId: "", version: "v1.0", author: "", tags: "" };

type DocRow = { id: number; title: string; type: string; content?: string | null; url?: string | null; applicationId?: number | null; applicationName?: string | null; version?: string | null; author?: string | null; tags?: string | null; updatedAt: string };

export default function Documentation() {
  const { data: documents, isLoading } = useListDocuments();
  const { mutateAsync: createDocument, isPending: isCreating } = useCreateDocument();
  const { mutateAsync: updateDocument, isPending: isUpdating } = useUpdateDocument();
  const { mutateAsync: deleteDocument, isPending: isDeleting } = useDeleteDocument();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DocRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocRow | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isPending = isCreating || isUpdating;
  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDocument({ id: deleteTarget.id });
      await queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      setDeleteTarget(null);
    } catch {
      // keep dialog open on failure; user can retry or cancel
    }
  };

  const openCreate = () => { setEditTarget(null); setForm({ ...EMPTY_FORM }); setErrors({}); setOpen(true); };

  const openEdit = (doc: DocRow) => {
    setEditTarget(doc);
    setForm({
      title: doc.title ?? "", type: doc.type ?? "", content: doc.content ?? "",
      url: doc.url ?? "", applicationId: doc.applicationId?.toString() ?? "",
      version: doc.version ?? "v1.0", author: doc.author ?? "", tags: doc.tags ?? "",
    });
    setErrors({});
    setOpen(true);
  };

  const validate = (): boolean => {
    const result = documentSchema.safeParse(form);
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
      title: form.title, type: form.type,
      content: form.content || undefined,
      url: form.url || undefined,
      applicationId: form.applicationId ? Number(form.applicationId) : undefined,
      version: form.version || undefined,
      author: form.author || undefined,
      tags: form.tags || undefined,
    };
    try {
      if (editTarget) {
        await updateDocument({ id: editTarget.id, data: payload });
      } else {
        await createDocument({ data: payload });
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      setOpen(false);
      setForm({ ...EMPTY_FORM });
      setErrors({});
    } catch {
      setErrors({ submit: `Failed to ${editTarget ? "update" : "create"} document.` });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Documentation Center</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />New Document</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Document Repository ({documents?.length ?? 0})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : documents && documents.length > 0 ? (
            <div className="overflow-x-auto -mx-6">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Application</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center">
                          <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                          {doc.url ? (
                            <a href={doc.url} target="_blank" rel="noreferrer" className="flex items-center text-primary hover:underline">
                              {doc.title} <ExternalLink className="h-3 w-3 ml-1" />
                            </a>
                          ) : doc.title}
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{doc.type}</Badge></TableCell>
                      <TableCell>{doc.applicationName || 'Global'}</TableCell>
                      <TableCell>{doc.version || 'v1.0'}</TableCell>
                      <TableCell>{new Date(doc.updatedAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(doc as DocRow)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(doc as DocRow)}>
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
              <p className="text-sm text-muted-foreground mb-4">No documents found.</p>
              <Button variant="outline" onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add First Document</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(v) => { if (!isPending) { setOpen(v); if (!v) { setForm({ ...EMPTY_FORM }); setErrors({}); } } }}>
        <DialogContent className="max-w-xl p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle>{editTarget ? "Edit Document" : "Add Document"}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <div className="px-6 py-5 space-y-4">
              {errors.submit && <div className="text-sm text-destructive bg-destructive/10 px-4 py-2 rounded-md">{errors.submit}</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Title" required>
                  <Input placeholder="MK Citizen Portal — PRD" value={form.title} onChange={set("title")} className="h-9" />
                  {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
                </Field>
                <Field label="Type" required>
                  <SelectField value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))} placeholder="Select type" options={TYPE_OPTIONS} />
                  {errors.type && <p className="text-xs text-destructive mt-1">{errors.type}</p>}
                </Field>
                <Field label="URL">
                  <Input placeholder="https://confluence.org/..." value={form.url} onChange={set("url")} className="h-9" />
                </Field>
                <Field label="Version">
                  <Input placeholder="v1.0" value={form.version} onChange={set("version")} className="h-9" />
                </Field>
                <Field label="Author">
                  <Input placeholder="Name" value={form.author} onChange={set("author")} className="h-9" />
                </Field>
                <Field label="Application ID">
                  <Input type="number" placeholder="1" value={form.applicationId} onChange={set("applicationId")} className="h-9" />
                  {errors.applicationId && <p className="text-xs text-destructive mt-1">{errors.applicationId}</p>}
                </Field>
              </div>
              <Field label="Tags">
                <Input placeholder="api, public, v2 (comma separated)" value={form.tags} onChange={set("tags")} className="h-9" />
              </Field>
              <Field label="Content">
                <Textarea placeholder="Document summary or content..." value={form.content} onChange={set("content")} rows={4} className="resize-none" />
              </Field>
            </div>
          </ScrollArea>
          <DialogFooter className="px-6 py-4 border-t gap-2">
            <Button variant="outline" onClick={() => { setOpen(false); setForm({ ...EMPTY_FORM }); setErrors({}); }} disabled={isPending}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{editTarget ? "Saving..." : "Adding..."}</> : editTarget ? "Save Changes" : "Add Document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
        entityName="document"
        itemLabel={deleteTarget?.title ?? ""}
        isPending={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
