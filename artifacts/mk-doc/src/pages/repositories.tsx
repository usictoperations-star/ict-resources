import React, { useState } from "react";
import { ExportButton } from "@/components/export-button";
import { z } from "zod";
import { useListRepositories, useCreateRepository, useUpdateRepository, useDeleteRepository } from "@workspace/api-client-react";
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
import { GitBranch, GitPullRequest, CircleDot, Plus, Loader2, Pencil, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { OwnerBadge } from "@/components/owner-badge";
import { OwnerSelectField } from "@/components/owner-select-field";
import { TeamSelectField } from "@/components/team-select-field";
import { TablePagination } from "@/components/table-pagination";

import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";

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

const LANG_COLORS: Record<string, string> = {
  TypeScript: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/50",
  JavaScript: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-800/50",
  Python:     "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50",
  Java:       "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/50",
  PHP:        "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/50",
  Go:         "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800/50",
  Rust:       "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50",
  "C#":       "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800/50",
};

function LangChip({ lang }: { lang?: string | null }) {
  if (!lang) return <span className="text-muted-foreground text-xs">—</span>;
  const cls = LANG_COLORS[lang] ?? "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${cls}`}>
      {lang}
    </span>
  );
}

function CountBadge({ icon: Icon, count, activeColor }: { icon: React.ElementType; count: number; activeColor: string }) {
  const hasItems = count > 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${hasItems ? activeColor : "text-muted-foreground"}`}>
      <Icon className="h-3.5 w-3.5" />
      {count}
    </span>
  );
}

const EMPTY_FORM = { name: "", url: "", defaultBranch: "main", visibility: "private", language: "", openPullRequests: "", openIssues: "", status: "active", notes: "", ownerId: "", teamId: "" };

type RepoRow = { id: number; name: string; url?: string | null; defaultBranch?: string | null; visibility: string; language?: string | null; openPullRequests: number; openIssues: number; status: string; notes?: string | null; ownerId?: number | null; ownerName?: string | null; teamId?: number | null };

const REPO_EXPORT_COLS = [
  { key: "name", label: "Repository" },
  { key: "url", label: "URL" },
  { key: "defaultBranch", label: "Default Branch" },
  { key: "visibility", label: "Visibility" },
  { key: "language", label: "Language" },
  { key: "openPullRequests", label: "Open PRs" },
  { key: "openIssues", label: "Open Issues" },
  { key: "status", label: "Status" },
  { key: "ownerName", label: "Owner" },
];

export default function Repositories() {
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const { data: repositoriesPage, isLoading } = useListRepositories({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  const repositories = repositoriesPage?.data ?? [];
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
  const total = repositoriesPage?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const startIndex = total === 0 ? 0 : (page - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, total);
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
      ownerId: repo.ownerId?.toString() ?? "",
      teamId: repo.teamId?.toString() ?? "",
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
      ownerId: form.ownerId ? Number(form.ownerId) : null,
      teamId: form.teamId ? Number(form.teamId) : null,
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
      <PageHeader
        icon={GitBranch}
        iconColor="#7C3AED"
        title="Repository Management"
        subtitle="Source code repositories, version control, and open pull request tracking"
        count={total}
        actions={
          <>
            <ExportButton data={(repositories ?? []) as unknown as Record<string, unknown>[]} columns={REPO_EXPORT_COLS} filename="repositories" title="Repository Management" />
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />New Repository</Button>
          </>
        }
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Source Code Repositories</CardTitle>
          <CardDescription>GitHub, GitLab, and other VCS repositories</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-4 w-12 ml-auto" />
                </div>
              ))}
            </div>
          ) : repositories && repositories.length > 0 ? (
            <div className="overflow-x-auto -mx-6">
              <Table className="min-w-[680px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Language</TableHead>
                    <TableHead>Visibility</TableHead>
                    <TableHead>PRs</TableHead>
                    <TableHead>Issues</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repositories.map((repo) => (
                    <TableRow key={repo.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div>
                          {repo.url ? (
                            <a href={repo.url} target="_blank" rel="noreferrer" className="font-semibold hover:underline text-foreground">
                              {repo.name}
                            </a>
                          ) : (
                            <span className="font-semibold">{repo.name}</span>
                          )}
                          {(repo as RepoRow).defaultBranch && (
                            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                              <GitBranch className="h-3 w-3" />{(repo as RepoRow).defaultBranch}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell><LangChip lang={(repo as RepoRow).language} /></TableCell>
                      <TableCell><StatusBadge status={repo.visibility} /></TableCell>
                      <TableCell>
                        <CountBadge
                          icon={GitPullRequest}
                          count={(repo as RepoRow).openPullRequests ?? 0}
                          activeColor="text-violet-600 dark:text-violet-400"
                        />
                      </TableCell>
                      <TableCell>
                        <CountBadge
                          icon={CircleDot}
                          count={(repo as RepoRow).openIssues ?? 0}
                          activeColor="text-amber-600 dark:text-amber-400"
                        />
                      </TableCell>
                      <TableCell><StatusBadge status={repo.status} /></TableCell>
                      <TableCell><OwnerBadge ownerName={(repo as RepoRow).ownerName} /></TableCell>
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
            <EmptyState
              icon={GitBranch}
              title="No repositories found"
              description="Connect your first repository to track its language, open PRs, issues, and visibility status."
              action={<Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add First Repository</Button>}
            />
          )}
          <TablePagination page={page} totalPages={totalPages} onPageChange={setPage} startIndex={startIndex} endIndex={endIndex} total={total} />
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
                <Field label="Owner">
                  <OwnerSelectField value={form.ownerId} onValueChange={v => setForm(f => ({ ...f, ownerId: v }))} />
                </Field>
                <Field label="Team">
                  <TeamSelectField value={form.teamId} onValueChange={v => setForm(f => ({ ...f, teamId: v }))} />
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
