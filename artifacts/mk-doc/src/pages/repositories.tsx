import React, { useState } from "react";
import { z } from "zod";
import { useListRepositories, useCreateRepository, useUpdateRepository, useDeleteRepository } from "@workspace/api-client-react";
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
import { GitPullRequest, CircleDot, Plus, Loader2, Pencil, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const VISIBILITY_OPTIONS = ["public", "private", "internal"];
const STATUS_OPTIONS = ["active", "archived", "inactive"];

const repoSchema = z.object({
  name: z.string().min(1, "Repository name is required"),
  visibility: z.string().min(1, "Visibility is required"),
  status: z.string().min(1, "Status is required"),
  openPullRequests: z.union([z.string().regex(/^\d*$/, "Must be a whole number"), z.literal("")]).optional(),
  openIssues: z.union([z.string().regex(/^\d*$/, "Must be a whole number"), z.literal("")]).optional(),
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

const EMPTY_FORM = { name: "", url: "", defaultBranch: "main", visibility: "private", language: "", openPullRequests: "", openIssues: "", status: "active", notes: "" };

type RepoRow = { id: number; name: string; url?: string | null; defaultBranch?: string | null; visibility: string; language?: string | null; openPullRequests: number; openIssues: number; status: string; notes?: string | null };

export default function Repositories() {
  const { data: repositories, isLoading } = useListRepositories();
  const { mutateAsync: createRepository, isPending: isCreating } = useCreateRepository();
  const { mutateAsync: updateRepository, isPending: isUpdating } = useUpdateRepository();
  const { mutateAsync: deleteRepository, isPending: isDeleting } = useDeleteRepository();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RepoRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RepoRow | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isPending = isCreating || isUpdating;
  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteRepository({ id: deleteTarget.id });
      await queryClient.invalidateQueries({ queryKey: ["/api/repositories"] });
      setDeleteTarget(null);
    } catch {
      // keep dialog open on failure; user can retry or cancel
    }
  };

  const openCreate = () => { setEditTarget(null); setForm({ ...EMPTY_FORM }); setErrors({}); setOpen(true); };

  const openEdit = (repo: RepoRow) => {
    setEditTarget(repo);
    setForm({
      name: repo.name ?? "", url: repo.url ?? "", defaultBranch: repo.defaultBranch ?? "main",
      visibility: repo.visibility ?? "private", language: repo.language ?? "",
      openPullRequests: repo.openPullRequests?.toString() ?? "0",
      openIssues: repo.openIssues?.toString() ?? "0",
      status: repo.status ?? "active", notes: repo.notes ?? "",
    });
    setErrors({});
    setOpen(true);
  };

  const validate = (): boolean => {
    const result = repoSchema.safeParse(form);
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
      url: form.url || undefined,
      defaultBranch: form.defaultBranch || undefined,
      visibility: form.visibility,
      language: form.language || undefined,
      openPullRequests: form.openPullRequests ? Number(form.openPullRequests) : undefined,
      openIssues: form.openIssues ? Number(form.openIssues) : undefined,
      status: form.status,
      notes: form.notes || undefined,
    };
    try {
      if (editTarget) {
        await updateRepository({ id: editTarget.id, data: payload });
      } else {
        await createRepository({ data: payload });
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/repositories"] });
      setOpen(false);
      setForm({ ...EMPTY_FORM });
      setErrors({});
    } catch {
      setErrors({ submit: `Failed to ${editTarget ? "update" : "create"} repository.` });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Repository Management</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />New Repository</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Source Code Repositories ({repositories?.length ?? 0})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : repositories && repositories.length > 0 ? (
            <div className="overflow-x-auto -mx-6">
              <Table className="min-w-[620px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Language</TableHead>
                    <TableHead>Visibility</TableHead>
                    <TableHead>PRs</TableHead>
                    <TableHead>Issues</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repositories.map((repo) => (
                    <TableRow key={repo.id}>
                      <TableCell className="font-medium">
                        {repo.url ? (
                          <a href={repo.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{repo.name}</a>
                        ) : repo.name}
                      </TableCell>
                      <TableCell>{repo.language ? <Badge variant="outline">{repo.language}</Badge> : 'N/A'}</TableCell>
                      <TableCell className="capitalize">{repo.visibility}</TableCell>
                      <TableCell>
                        <div className="flex items-center text-muted-foreground"><GitPullRequest className="w-4 h-4 mr-1" />{repo.openPullRequests}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center text-muted-foreground"><CircleDot className="w-4 h-4 mr-1" />{repo.openIssues}</div>
                      </TableCell>
                      <TableCell><Badge variant={repo.status === 'active' ? 'default' : 'secondary'}>{repo.status}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(repo as RepoRow)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(repo as RepoRow)}>
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
              <p className="text-sm text-muted-foreground mb-4">No repositories found.</p>
              <Button variant="outline" onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add First Repository</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(v) => { if (!isPending) { setOpen(v); if (!v) { setForm({ ...EMPTY_FORM }); setErrors({}); } } }}>
        <DialogContent className="max-w-xl p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle>{editTarget ? "Edit Repository" : "Add Repository"}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <div className="px-6 py-5 space-y-4">
              {errors.submit && <div className="text-sm text-destructive bg-destructive/10 px-4 py-2 rounded-md">{errors.submit}</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Repository Name" required>
                  <Input placeholder="mk-citizen-portal" value={form.name} onChange={set("name")} className="h-9" />
                  {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
                </Field>
                <Field label="URL">
                  <Input placeholder="https://github.com/org/repo" value={form.url} onChange={set("url")} className="h-9" />
                </Field>
                <Field label="Default Branch">
                  <Input placeholder="main" value={form.defaultBranch} onChange={set("defaultBranch")} className="h-9" />
                </Field>
                <Field label="Visibility" required>
                  <SelectField value={form.visibility} onValueChange={v => setForm(f => ({ ...f, visibility: v }))} placeholder="Select visibility" options={VISIBILITY_OPTIONS} />
                  {errors.visibility && <p className="text-xs text-destructive mt-1">{errors.visibility}</p>}
                </Field>
                <Field label="Language">
                  <Input placeholder="TypeScript, Python..." value={form.language} onChange={set("language")} className="h-9" />
                </Field>
                <Field label="Status">
                  <SelectField value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))} placeholder="Select status" options={STATUS_OPTIONS} />
                </Field>
                <Field label="Open Pull Requests">
                  <Input type="number" placeholder="0" value={form.openPullRequests} onChange={set("openPullRequests")} className="h-9" />
                  {errors.openPullRequests && <p className="text-xs text-destructive mt-1">{errors.openPullRequests}</p>}
                </Field>
                <Field label="Open Issues">
                  <Input type="number" placeholder="0" value={form.openIssues} onChange={set("openIssues")} className="h-9" />
                  {errors.openIssues && <p className="text-xs text-destructive mt-1">{errors.openIssues}</p>}
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
              {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{editTarget ? "Saving..." : "Adding..."}</> : editTarget ? "Save Changes" : "Add Repository"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
        entityName="repository"
        itemLabel={deleteTarget?.name ?? ""}
        isPending={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
