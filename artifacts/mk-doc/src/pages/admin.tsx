import React, { useState } from "react";
import { z } from "zod";
import { useListUsers, useListAuditLogs, useCreateUser, useUpdateUser, useDeleteUser, useListTeams, useCreateTeam, useUpdateTeam, useDeleteTeam } from "@workspace/api-client-react";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, Pencil, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { TablePagination } from "@/components/table-pagination";
import { usePagination } from "@/hooks/use-pagination";

const ROLE_OPTIONS = ["admin", "manager", "operator", "viewer", "auditor"];
const STATUS_OPTIONS = ["active", "inactive", "suspended"];

const userSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().min(1, "Email is required").email("Must be a valid email address"),
  role: z.string().min(1, "Role is required"),
  status: z.string().min(1, "Status is required"),
});

const teamSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required").regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only"),
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

const EMPTY_FORM = { name: "", email: "", role: "viewer", department: "", status: "active" };

type UserRow = { id: number; name: string; email: string; role: string; department?: string | null; status: string; lastLoginAt?: string | null };

const EMPTY_TEAM_FORM = { name: "", slug: "", description: "" };

type TeamRow = { id: number; name: string; slug: string; description?: string | null };

export default function Admin() {
  const { data: users, isLoading: usersLoading } = useListUsers();
  const { data: auditLogs, isLoading: logsLoading } = useListAuditLogs({ limit: 50 });
  const { mutateAsync: createUser, isPending: isCreating } = useCreateUser();
  const { mutateAsync: updateUser, isPending: isUpdating } = useUpdateUser();
  const { mutateAsync: deleteUser, isPending: isDeleting } = useDeleteUser();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isPending = isCreating || isUpdating;
  const { page: usersPage, setPage: setUsersPage, totalPages: usersTotalPages, pageItems: pagedUsers, startIndex: usersStartIndex, endIndex: usersEndIndex, total: usersTotal } = usePagination(users, 10);
  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [field]: e.target.value }));

  const { data: teams, isLoading: teamsLoading } = useListTeams();
  const { mutateAsync: createTeam, isPending: isCreatingTeam } = useCreateTeam();
  const { mutateAsync: updateTeam, isPending: isUpdatingTeam } = useUpdateTeam();
  const { mutateAsync: deleteTeam, isPending: isDeletingTeam } = useDeleteTeam();

  const [teamOpen, setTeamOpen] = useState(false);
  const [teamEditTarget, setTeamEditTarget] = useState<TeamRow | null>(null);
  const [teamDeleteTarget, setTeamDeleteTarget] = useState<TeamRow | null>(null);
  const [teamForm, setTeamForm] = useState({ ...EMPTY_TEAM_FORM });
  const [teamErrors, setTeamErrors] = useState<Record<string, string>>({});

  const isTeamPending = isCreatingTeam || isUpdatingTeam;
  const { page: teamsPage, setPage: setTeamsPage, totalPages: teamsTotalPages, pageItems: pagedTeams, startIndex: teamsStartIndex, endIndex: teamsEndIndex, total: teamsTotal } = usePagination(teams, 10);
  const { page: auditPage, setPage: setAuditPage, totalPages: auditTotalPages, pageItems: pagedAuditLogs, startIndex: auditStartIndex, endIndex: auditEndIndex, total: auditTotal } = usePagination(auditLogs, 10);
  const setTeam = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setTeamForm(f => ({ ...f, [field]: e.target.value }));

  const handleTeamDelete = async () => {
    if (!teamDeleteTarget) return;
    try {
      await deleteTeam({ id: teamDeleteTarget.id });
      await queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      setTeamDeleteTarget(null);
    } catch {
      // keep dialog open on failure; user can retry or cancel
    }
  };

  const openTeamCreate = () => { setTeamEditTarget(null); setTeamForm({ ...EMPTY_TEAM_FORM }); setTeamErrors({}); setTeamOpen(true); };

  const openTeamEdit = (team: TeamRow) => {
    setTeamEditTarget(team);
    setTeamForm({ name: team.name ?? "", slug: team.slug ?? "", description: team.description ?? "" });
    setTeamErrors({});
    setTeamOpen(true);
  };

  const validateTeam = (): boolean => {
    const result = teamSchema.safeParse(teamForm);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach(issue => {
        const field = issue.path[0] as string;
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      });
      setTeamErrors(fieldErrors);
      return false;
    }
    setTeamErrors({});
    return true;
  };

  const handleTeamSubmit = async () => {
    if (!validateTeam()) return;
    const payload = { name: teamForm.name, slug: teamForm.slug, description: teamForm.description || undefined };
    try {
      if (teamEditTarget) {
        await updateTeam({ id: teamEditTarget.id, data: payload });
      } else {
        await createTeam({ data: payload });
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      setTeamOpen(false);
      setTeamForm({ ...EMPTY_TEAM_FORM });
      setTeamErrors({});
    } catch {
      setTeamErrors({ submit: `Failed to ${teamEditTarget ? "update" : "create"} team.` });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteUser({ id: deleteTarget.id });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setDeleteTarget(null);
    } catch {
      // keep dialog open on failure; user can retry or cancel
    }
  };

  const openCreate = () => { setEditTarget(null); setForm({ ...EMPTY_FORM }); setErrors({}); setOpen(true); };

  const openEdit = (user: UserRow) => {
    setEditTarget(user);
    setForm({ name: user.name ?? "", email: user.email ?? "", role: user.role ?? "viewer", department: user.department ?? "", status: user.status ?? "active" });
    setErrors({});
    setOpen(true);
  };

  const validate = (): boolean => {
    const result = userSchema.safeParse(form);
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
    const payload = { name: form.name, email: form.email, role: form.role, department: form.department || undefined, status: form.status };
    try {
      if (editTarget) {
        await updateUser({ id: editTarget.id, data: payload });
      } else {
        await createUser({ data: payload });
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setOpen(false);
      setForm({ ...EMPTY_FORM });
      setErrors({});
    } catch {
      setErrors({ submit: `Failed to ${editTarget ? "update" : "create"} user.` });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Administration</h1>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList>
          <TabsTrigger value="users">Users & Roles</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Manage user access and roles across MK DOC.</CardDescription>
              </div>
              <Button onClick={openCreate} size="sm"><Plus className="h-4 w-4 mr-2" />New User</Button>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : users && users.length > 0 ? (
                <div className="overflow-x-auto -mx-6">
                  <Table className="min-w-[700px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Login</TableHead>
                        <TableHead className="w-16"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell><Badge variant="outline" className="capitalize">{user.role}</Badge></TableCell>
                          <TableCell>{user.department || 'N/A'}</TableCell>
                          <TableCell><Badge variant={user.status === 'active' ? 'default' : 'secondary'}>{user.status}</Badge></TableCell>
                          <TableCell className="text-muted-foreground text-sm">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(user as UserRow)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(user as UserRow)}>
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
                  <p className="text-sm text-muted-foreground mb-4">No users found.</p>
                  <Button variant="outline" onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add First User</Button>
                </div>
              )}
              <TablePagination page={usersPage} totalPages={usersTotalPages} onPageChange={setUsersPage} startIndex={usersStartIndex} endIndex={usersEndIndex} total={usersTotal} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="teams" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle>Team Management</CardTitle>
                <CardDescription>Define the teams that own applications, infrastructure, and other assets.</CardDescription>
              </div>
              <Button onClick={openTeamCreate} size="sm"><Plus className="h-4 w-4 mr-2" />New Team</Button>
            </CardHeader>
            <CardContent>
              {teamsLoading ? (
                <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : teams && teams.length > 0 ? (
                <div className="overflow-x-auto -mx-6">
                  <Table className="min-w-[500px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Slug</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-16"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedTeams.map((team) => (
                        <TableRow key={team.id}>
                          <TableCell className="font-medium">{team.name}</TableCell>
                          <TableCell><Badge variant="outline" className="font-mono text-xs">{team.slug}</Badge></TableCell>
                          <TableCell className="text-muted-foreground text-sm">{team.description || 'N/A'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openTeamEdit(team as TeamRow)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setTeamDeleteTarget(team as TeamRow)}>
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
                  <p className="text-sm text-muted-foreground mb-4">No teams found.</p>
                  <Button variant="outline" onClick={openTeamCreate}><Plus className="h-4 w-4 mr-2" />Add First Team</Button>
                </div>
              )}
              <TablePagination page={teamsPage} totalPages={teamsTotalPages} onPageChange={setTeamsPage} startIndex={teamsStartIndex} endIndex={teamsEndIndex} total={teamsTotal} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>System Audit Logs</CardTitle>
              <CardDescription>Recent activity across all MK DOC modules.</CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : auditLogs && auditLogs.length > 0 ? (
                <div className="overflow-x-auto -mx-6">
                  <Table className="min-w-[600px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Entity Type</TableHead>
                        <TableHead>Entity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedAuditLogs.map((log) => (
                        <TableRow key={log.id} className="text-sm">
                          <TableCell className="text-muted-foreground whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</TableCell>
                          <TableCell className="font-medium">{log.userName || `User #${log.userId}`}</TableCell>
                          <TableCell><Badge variant="outline" className="uppercase text-[10px]">{log.action}</Badge></TableCell>
                          <TableCell className="capitalize">{log.entityType}</TableCell>
                          <TableCell className="font-mono text-xs truncate max-w-[200px]">{log.entityName || `ID: ${log.entityId}`}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No audit logs found.</p>
              )}
              <TablePagination page={auditPage} totalPages={auditTotalPages} onPageChange={setAuditPage} startIndex={auditStartIndex} endIndex={auditEndIndex} total={auditTotal} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={(v) => { if (!isPending) { setOpen(v); if (!v) { setForm({ ...EMPTY_FORM }); setErrors({}); } } }}>
        <DialogContent className="max-w-md p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle>{editTarget ? "Edit User" : "Add User"}</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-5 space-y-4">
            {errors.submit && <div className="text-sm text-destructive bg-destructive/10 px-4 py-2 rounded-md">{errors.submit}</div>}
            <Field label="Full Name" required>
              <Input placeholder="John Smith" value={form.name} onChange={set("name")} className="h-9" />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
            </Field>
            <Field label="Email" required>
              <Input type="email" placeholder="john.smith@mk.gov" value={form.email} onChange={set("email")} className="h-9" />
              {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Role" required>
                <SelectField value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))} placeholder="Select role" options={ROLE_OPTIONS} />
                {errors.role && <p className="text-xs text-destructive mt-1">{errors.role}</p>}
              </Field>
              <Field label="Status">
                <SelectField value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))} placeholder="Select status" options={STATUS_OPTIONS} />
              </Field>
            </div>
            <Field label="Department">
              <Input placeholder="Platform Team" value={form.department} onChange={set("department")} className="h-9" />
            </Field>
          </div>
          <DialogFooter className="px-6 py-4 border-t gap-2">
            <Button variant="outline" onClick={() => { setOpen(false); setForm({ ...EMPTY_FORM }); setErrors({}); }} disabled={isPending}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{editTarget ? "Saving..." : "Adding..."}</> : editTarget ? "Save Changes" : "Add User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
        entityName="user"
        itemLabel={deleteTarget?.name ?? ""}
        isPending={isDeleting}
        onConfirm={handleDelete}
      />

      <Dialog open={teamOpen} onOpenChange={(v) => { if (!isTeamPending) { setTeamOpen(v); if (!v) { setTeamForm({ ...EMPTY_TEAM_FORM }); setTeamErrors({}); } } }}>
        <DialogContent className="max-w-md p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle>{teamEditTarget ? "Edit Team" : "Add Team"}</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-5 space-y-4">
            {teamErrors.submit && <div className="text-sm text-destructive bg-destructive/10 px-4 py-2 rounded-md">{teamErrors.submit}</div>}
            <Field label="Team Name" required>
              <Input placeholder="Infrastructure & Cloud Operations" value={teamForm.name} onChange={setTeam("name")} className="h-9" />
              {teamErrors.name && <p className="text-xs text-destructive mt-1">{teamErrors.name}</p>}
            </Field>
            <Field label="Slug" required>
              <Input placeholder="infra-cloud-ops" value={teamForm.slug} onChange={setTeam("slug")} className="h-9" />
              {teamErrors.slug && <p className="text-xs text-destructive mt-1">{teamErrors.slug}</p>}
            </Field>
            <Field label="Description">
              <Textarea placeholder="What this team owns..." value={teamForm.description} onChange={setTeam("description")} rows={2} className="resize-none" />
            </Field>
          </div>
          <DialogFooter className="px-6 py-4 border-t gap-2">
            <Button variant="outline" onClick={() => { setTeamOpen(false); setTeamForm({ ...EMPTY_TEAM_FORM }); setTeamErrors({}); }} disabled={isTeamPending}>Cancel</Button>
            <Button onClick={handleTeamSubmit} disabled={isTeamPending}>
              {isTeamPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{teamEditTarget ? "Saving..." : "Adding..."}</> : teamEditTarget ? "Save Changes" : "Add Team"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!teamDeleteTarget}
        onOpenChange={(v) => { if (!v) setTeamDeleteTarget(null); }}
        entityName="team"
        itemLabel={teamDeleteTarget?.name ?? ""}
        isPending={isDeletingTeam}
        onConfirm={handleTeamDelete}
      />
    </div>
  );
}
