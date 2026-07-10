import React, { useRef, useState } from "react";
import { z } from "zod";
import { useListDocuments, useCreateDocument, useUpdateDocument, useDeleteDocument } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BookOpen, FileText, ExternalLink, FolderOpen, Plus, Loader2, Pencil, Trash2, UploadCloud, Link2, CheckCircle2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { ObjectUploader } from "@workspace/object-storage-web";
import type { UppyFile, UploadResult } from "@uppy/core";
import { TablePagination } from "@/components/table-pagination";

import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

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

const TYPE_COLORS: Record<string, string> = {
  PRD:          "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/50",
  TRD:          "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/50",
  SOP:          "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50",
  ERD:          "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50",
  API:          "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800/50",
  Architecture: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/50",
  Runbook:      "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/50",
  Guide:        "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800/50",
  Policy:       "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700",
  Other:        "bg-muted text-muted-foreground border-border",
};

function DocTypeBadge({ type }: { type: string }) {
  const cls = TYPE_COLORS[type] ?? TYPE_COLORS["Other"];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${cls}`}>
      {type}
    </span>
  );
}

const EMPTY_FORM = { title: "", type: "", content: "", url: "", fileName: "", applicationId: "", version: "v1.0", author: "", tags: "" };

type DocRow = { id: number; title: string; type: string; content?: string | null; url?: string | null; applicationId?: number | null; applicationName?: string | null; version?: string | null; author?: string | null; tags?: string | null; updatedAt: string };

type AttachSource = "upload" | "gdrive" | "sharepoint" | "link";

function detectSource(url: string): AttachSource {
  if (!url) return "upload";
  if (url.startsWith("/api/storage/objects/")) return "upload";
  if (/drive\.google\.com|docs\.google\.com/.test(url)) return "gdrive";
  if (/sharepoint\.com|1drv\.ms/.test(url)) return "sharepoint";
  return "link";
}

function fileNameFromObjectPath(url: string): string {
  const parts = url.split("/");
  return decodeURIComponent(parts[parts.length - 1] || "Uploaded file");
}

export default function Documentation() {
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const { data: documentsPage, isLoading } = useListDocuments({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  const documents = documentsPage?.data ?? [];
  const { mutateAsync: createDocument, isPending: isCreating } = useCreateDocument();
  const { mutateAsync: updateDocument, isPending: isUpdating } = useUpdateDocument();
  const { mutateAsync: deleteDocument, isPending: isDeleting } = useDeleteDocument();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DocRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocRow | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [attachSource, setAttachSource] = useState<AttachSource>("upload");
  const [isUploading, setIsUploading] = useState(false);

  const isPending = isCreating || isUpdating;
  const total = documentsPage?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const startIndex = total === 0 ? 0 : (page - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, total);
  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [field]: e.target.value }));

  const lastObjectPathRef = useRef<string | null>(null);

  const handleGetUploadParameters = async (file: UppyFile<Record<string, unknown>, Record<string, unknown>>) => {
    setIsUploading(true);
    const res = await fetch("/api/storage/uploads/request-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: file.name, size: file.size ?? 0, contentType: file.type || "application/octet-stream" }),
    });
    if (!res.ok) {
      setIsUploading(false);
      throw new Error("Failed to request upload URL");
    }
    const { uploadURL, objectPath } = (await res.json()) as { uploadURL: string; objectPath: string };
    lastObjectPathRef.current = objectPath;
    return { method: "PUT" as const, url: uploadURL, headers: { "Content-Type": file.type || "application/octet-stream" } };
  };

  const handleUploadComplete = (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    setIsUploading(false);
    const uploaded = result.successful?.[0];
    const objectPath = lastObjectPathRef.current;
    if (!uploaded || !objectPath) return;
    const servingUrl = `/api/storage${objectPath}`;
    setForm(f => ({
      ...f,
      url: servingUrl,
      fileName: uploaded.name || fileNameFromObjectPath(servingUrl),
      title: f.title || (uploaded.name ?? "").replace(/\.[^./]+$/, ""),
    }));
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDocument({ id: deleteTarget.id });
      await queryClient.invalidateQueries({ queryKey: ["/api/documentation"] });
      setDeleteTarget(null);
    } catch {
      // keep dialog open on failure; user can retry or cancel
    }
  };

  const openCreate = () => { setEditTarget(null); setForm({ ...EMPTY_FORM }); setErrors({}); setAttachSource("upload"); setOpen(true); };

  const openEdit = (doc: DocRow) => {
    setEditTarget(doc);
    const url = doc.url ?? "";
    setForm({
      title: doc.title ?? "", type: doc.type ?? "", content: doc.content ?? "",
      url, fileName: url.startsWith("/api/storage/objects/") ? fileNameFromObjectPath(url) : "",
      applicationId: doc.applicationId?.toString() ?? "",
      version: doc.version ?? "v1.0", author: doc.author ?? "", tags: doc.tags ?? "",
    });
    setErrors({});
    setAttachSource(detectSource(url));
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
      await queryClient.invalidateQueries({ queryKey: ["/api/documentation"] });
      setOpen(false);
      setForm({ ...EMPTY_FORM });
      setErrors({});
      toast({ title: editTarget ? "Document updated" : "Document created" });
    } catch (err) {
      const message = `Failed to ${editTarget ? "update" : "create"} document.`;
      setErrors({ submit: message });
      toast({ title: message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BookOpen}
        iconColor="#1B56A5"
        title="Documentation Center"
        subtitle="PRDs, TRDs, SOPs, runbooks, and technical documents — all in one place"
        count={total}
        actions={
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />New Document</Button>
        }
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Document Repository</CardTitle>
          <CardDescription>Click a document title to open it — files, Google Drive, and SharePoint links all supported</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-4 w-24 ml-auto" />
                </div>
              ))}
            </div>
          ) : documents && documents.length > 0 ? (
            <div className="overflow-x-auto -mx-6">
              <Table className="min-w-[620px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Application</TableHead>
                    <TableHead>Author</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-start gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground/50 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            {doc.url ? (
                              <a href={doc.url} target="_blank" rel="noreferrer" className="font-semibold hover:underline text-foreground flex items-center gap-1">
                                {doc.title} <ExternalLink className="h-3 w-3 text-muted-foreground" />
                              </a>
                            ) : (
                              <span className="font-semibold">{doc.title}</span>
                            )}
                            {(doc as DocRow).version && (
                              <p className="text-xs text-muted-foreground mt-0.5">{(doc as DocRow).version}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><DocTypeBadge type={doc.type} /></TableCell>
                      <TableCell>
                        <span className="text-xs">{(doc as DocRow).applicationName || "Global"}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs">{(doc as DocRow).author || "—"}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs">{new Date(doc.updatedAt).toLocaleDateString()}</span>
                      </TableCell>
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
            <EmptyState
              icon={FolderOpen}
              title="No documents yet"
              description="Upload files, paste Google Drive or SharePoint links, or write inline content to build your knowledge base."
              action={<Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add First Document</Button>}
            />
          )}
          <TablePagination page={page} totalPages={totalPages} onPageChange={setPage} startIndex={startIndex} endIndex={endIndex} total={total} />
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
              <Field label="Attachment">
                <Tabs value={attachSource} onValueChange={(v) => setAttachSource(v as AttachSource)}>
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="upload">Desktop</TabsTrigger>
                    <TabsTrigger value="gdrive">Google Drive</TabsTrigger>
                    <TabsTrigger value="sharepoint">SharePoint</TabsTrigger>
                    <TabsTrigger value="link">Other Link</TabsTrigger>
                  </TabsList>
                  <TabsContent value="upload" className="space-y-2">
                    <ObjectUploader
                      maxNumberOfFiles={1}
                      maxFileSize={26214400}
                      onGetUploadParameters={handleGetUploadParameters}
                      onComplete={handleUploadComplete}
                      buttonClassName="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 border [border-color:var(--button-outline)] shadow-xs hover-elevate active-elevate-2 h-9 w-full px-4"
                    >
                      <UploadCloud className="h-4 w-4 mr-2" />
                      {isUploading ? "Uploading..." : "Choose file from computer"}
                    </ObjectUploader>
                    {form.fileName && attachSource === "upload" && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> {form.fileName}
                      </p>
                    )}
                  </TabsContent>
                  <TabsContent value="gdrive" className="space-y-1">
                    <Input placeholder="Paste Google Drive share link..." value={form.url} onChange={set("url")} className="h-9" />
                    <p className="text-xs text-muted-foreground">Paste a shareable link from Google Drive (set access to "Anyone with the link").</p>
                  </TabsContent>
                  <TabsContent value="sharepoint" className="space-y-1">
                    <Input placeholder="Paste SharePoint link..." value={form.url} onChange={set("url")} className="h-9" />
                    <p className="text-xs text-muted-foreground">Paste a shared link from SharePoint or OneDrive.</p>
                  </TabsContent>
                  <TabsContent value="link" className="space-y-1">
                    <Input placeholder="https://confluence.org/..." value={form.url} onChange={set("url")} className="h-9" />
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Link2 className="h-3 w-3" /> Any other external URL.</p>
                  </TabsContent>
                </Tabs>
              </Field>
              <Field label="Tags">
                <Input placeholder="api, public, v2 (comma separated)" value={form.tags} onChange={set("tags")} className="h-9" />
              </Field>
              <Field label="Content">
                <Textarea placeholder="Document summary or content..." value={form.content} onChange={set("content")} rows={4} className="resize-none" />
              </Field>
            </div>
          </ScrollArea>
          <DialogFooter className="px-6 py-4 border-t gap-2">
            <Button type="button" variant="outline" onClick={() => { setOpen(false); setForm({ ...EMPTY_FORM }); setErrors({}); }} disabled={isPending}>Cancel</Button>
            <Button type="button" onClick={handleSubmit} disabled={isPending}>
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
