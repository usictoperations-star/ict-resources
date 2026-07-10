import React, { useState } from "react";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { ApiError } from "@workspace/api-client-react";
import { useListUsers, useListAuditLogs, useCreateUser, useUpdateUser, useDeleteUser, useListTeams, useCreateTeam, useUpdateTeam, useDeleteTeam, useListDeletedRecords, useRestoreApplication, useRestoreInfrastructure, useRestoreDatabase, useRestoreDomain, useRestoreRepository, useRestoreRelease, useRestoreVulnerability, useRestoreSoftware, useRestoreDocument } from "@workspace/api-client-react";
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
import { Plus, Loader2, Pencil, Trash2, RotateCcw, KeyRound, CheckCircle2, Eye, EyeOff, Wand2, Copy, Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { TablePagination } from "@/components/table-pagination";
import { usePagination } from "@/hooks/use-pagination";
import { useAuth } from "@/contexts/auth";

function generatePassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^&*-+=?";
  const all = upper + lower + digits + symbols;
  const rand = (chars: string) => chars[Math.floor(Math.random() * chars.length)];
  const core = [rand(upper), rand(upper), rand(lower), rand(lower), rand(digits), rand(digits), rand(symbols)];
  const rest = Array.from({ length: 7 }, () => rand(all));
  return [...core, ...rest].sort(() => Math.random() - 0.5).join("");
}

const ROLE_OPTIONS = ["admin", "editor", "analyst", "viewer"] as const;
const STATUS_OPTIONS = ["Active", "Inactive", "Suspended"];

const ROLE_LABELS: Record<string, string> = {
  admin:   "Admin",
  editor:  "Editor",
  analyst: "Audit & Inspection",
  viewer:  "Viewer",
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin:   "Full access including user management and deletes",
  editor:  "Create and edit everything, no user management",
  analyst: "Read-only access to all data and reports",
  viewer:  "Read-only access to core modules",
};

const ROLE_BADGE: Record<string, string> = {
  admin:   "bg-red-100 text-red-700 border-red-200",
  editor:  "bg-blue-100 text-blue-700 border-blue-200",
  analyst: "bg-amber-100 text-amber-700 border-amber-200",
  viewer:  "bg-gray-100 text-gray-600 border-gray-200",
};

const userSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().min(1, "Email is required").email("Must be a valid email address"),
  role: z.string().min(1, "Role is required"),
  status: z.string().min(1, "Status is required"),
  phone: z.string().optional(),
  password: z.string().optional(),
});

const teamSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required").regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only"),
});

function Field({ label, required, children, error, hint }: { label: string; required?: boolean; children: React.ReactNode; error?: string; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function SelectField({ value, onValueChange, placeholder, options }: { value: string; onValueChange: (v: string) => void; placeholder: string; options: string[] }) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-9"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>{options.map(o => <SelectItem key={o} value={o} className="capitalize">{o}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function RoleSelectField({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">Role<span className="text-destructive ml-0.5">*</span></Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9"><SelectValue placeholder="Select role" /></SelectTrigger>
        <SelectContent>
          {ROLE_OPTIONS.map(role => (
            <SelectItem key={role} value={role}>
              <div>
                <span className="font-medium">{ROLE_LABELS[role] ?? role}</span>
                <p className="text-[10px] text-muted-foreground leading-tight">{ROLE_DESCRIPTIONS[role]}</p>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder, onGenerate }: { value: string; onChange: (v: string) => void; placeholder?: string; onGenerate?: () => void }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 pr-9 font-mono text-sm"
          autoComplete="new-password"
        />
        <button
          type="button"
          onClick={() => setShow(v => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          tabIndex={-1}
        >
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
      <div className="flex items-center gap-2">
        {onGenerate && (
          <button
            type="button"
            onClick={() => { onGenerate(); setShow(true); }}
            className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            <Wand2 className="h-3 w-3" />
            Generate strong password
          </button>
        )}
        {value && (
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied!" : "Copy"}
          </button>
        )}
      </div>
    </div>
  );
}

const EMPTY_FORM = { name: "", email: "", role: "viewer", phone: "", department: "", status: "Active", password: "" };

type UserRow = {
  id: number; name: string; email: string; role: string;
  phone?: string | null; department?: string | null; status: string;
  lastLoginAt?: string | null; hasPassword?: boolean;
};

const EMPTY_TEAM_FORM = { name: "", slug: "", description: "" };
type TeamRow = { id: number; name: string; slug: string; description?: string | null };
type DeletedEntity = { id: number; name: string; deletedAt?: string | null };

const ENTITY_TYPE_LABELS: Record<string, string> = {
  applications: "Application",
  infrastructure: "Infrastructure",
  databases: "Database",
  domains: "Domain",
  repositories: "Repository",
  releases: "Release",
  vulnerabilities: "Vulnerability",
  software: "Software",
  documents: "Document",
};

export default function Admin() {
  const { can } = useAuth();
  const canWrite = can("write");
  const canAdmin = can("admin");

  const { data: users, isLoading: usersLoading } = useListUsers();
  const AUDIT_PAGE_SIZE = 20;
  const [auditPage, setAuditPage] = useState(1);
  const { data: auditLogsPage, isLoading: logsLoading } = useListAuditLogs({ limit: AUDIT_PAGE_SIZE, offset: (auditPage - 1) * AUDIT_PAGE_SIZE });
  const auditLogs = auditLogsPage?.data ?? [];
  const { mutateAsync: createUser, isPending: isCreating } = useCreateUser();
  const { mutateAsync: updateUser, isPending: isUpdating } = useUpdateUser();
  const { mutateAsync: deleteUser, isPending: isDeleting } = useDeleteUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isPending = isCreating || isUpdating;
  const { page: usersPage, setPage: setUsersPage, totalPages: usersTotalPages, pageItems: pagedUsers, startIndex: usersStartIndex, endIndex: usersEndIndex, total: usersTotal } = usePagination(users, 10);
  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [field]: e.target.value }));

  const TEAMS_PAGE_SIZE = 20;
  const [teamsPage, setTeamsPage] = useState(1);
  const { data: teamsListPage, isLoading: teamsLoading } = useListTeams({ limit: TEAMS_PAGE_SIZE, offset: (teamsPage - 1) * TEAMS_PAGE_SIZE });
  const teams = teamsListPage?.data ?? [];
  const { mutateAsync: createTeam, isPending: isCreatingTeam } = useCreateTeam();
  const { mutateAsync: updateTeam, isPending: isUpdatingTeam } = useUpdateTeam();
  const { mutateAsync: deleteTeam, isPending: isDeletingTeam } = useDeleteTeam();

  const [teamOpen, setTeamOpen] = useState(false);
  const [teamEditTarget, setTeamEditTarget] = useState<TeamRow | null>(null);
  const [teamDeleteTarget, setTeamDeleteTarget] = useState<TeamRow | null>(null);
  const [teamForm, setTeamForm] = useState({ ...EMPTY_TEAM_FORM });
  const [teamErrors, setTeamErrors] = useState<Record<string, string>>({});

  const isTeamPending = isCreatingTeam || isUpdatingTeam;
  const teamsTotal = teamsListPage?.total ?? 0;
  const teamsTotalPages = Math.max(1, Math.ceil(teamsTotal / TEAMS_PAGE_SIZE));
  const teamsStartIndex = teamsTotal === 0 ? 0 : (teamsPage - 1) * TEAMS_PAGE_SIZE;
  const teamsEndIndex = Math.min(teamsStartIndex + TEAMS_PAGE_SIZE, teamsTotal);
  const auditTotal = auditLogsPage?.total ?? 0;
  const auditTotalPages = Math.max(1, Math.ceil(auditTotal / AUDIT_PAGE_SIZE));
  const auditStartIndex = auditTotal === 0 ? 0 : (auditPage - 1) * AUDIT_PAGE_SIZE;
  const auditEndIndex = Math.min(auditStartIndex + AUDIT_PAGE_SIZE, auditTotal);
  const setTeam = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setTeamForm(f => ({ ...f, [field]: e.target.value }));

  const { data: deletedRecords, isLoading: deletedLoading } = useListDeletedRecords();
  const { mutateAsync: restoreApplication, isPending: isRestoringApp } = useRestoreApplication();
  const { mutateAsync: restoreInfrastructure, isPending: isRestoringInfra } = useRestoreInfrastructure();
  const { mutateAsync: restoreDatabase, isPending: isRestoringDb } = useRestoreDatabase();
  const { mutateAsync: restoreDomain } = useRestoreDomain();
  const { mutateAsync: restoreRepository } = useRestoreRepository();
  const { mutateAsync: restoreRelease } = useRestoreRelease();
  const { mutateAsync: restoreVulnerability } = useRestoreVulnerability();
  const { mutateAsync: restoreSoftware } = useRestoreSoftware();
  const { mutateAsync: restoreDocument } = useRestoreDocument();
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const totalDeleted = (deletedRecords?.applications?.length ?? 0) +
    (deletedRecords?.infrastructure?.length ?? 0) +
    (deletedRecords?.databases?.length ?? 0) +
    (deletedRecords?.domains?.length ?? 0) +
    (deletedRecords?.repositories?.length ?? 0) +
    (deletedRecords?.releases?.length ?? 0) +
    (deletedRecords?.vulnerabilities?.length ?? 0) +
    (deletedRecords?.software?.length ?? 0) +
    (deletedRecords?.documents?.length ?? 0);

  const handleRestore = async (entityType: "applications" | "infrastructure" | "databases" | "domains" | "repositories" | "releases" | "vulnerabilities" | "software" | "documents", id: number) => {
    const key = `${entityType}:${id}`;
    setRestoringId(key);
    try {
      if (entityType === "applications") {
        await restoreApplication({ id });
        await queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      } else if (entityType === "infrastructure") {
        await restoreInfrastructure({ id });
        await queryClient.invalidateQueries({ queryKey: ["/api/infrastructure"] });
      } else if (entityType === "databases") {
        await restoreDatabase({ id });
        await queryClient.invalidateQueries({ queryKey: ["/api/databases"] });
      } else if (entityType === "domains") {
        await restoreDomain({ id });
        await queryClient.invalidateQueries({ queryKey: ["/api/domains"] });
      } else if (entityType === "repositories") {
        await restoreRepository({ id });
        await queryClient.invalidateQueries({ queryKey: ["/api/repositories"] });
      } else if (entityType === "releases") {
        await restoreRelease({ id });
        await queryClient.invalidateQueries({ queryKey: ["/api/releases"] });
      } else if (entityType === "vulnerabilities") {
        await restoreVulnerability({ id });
        await queryClient.invalidateQueries({ queryKey: ["/api/security/vulnerabilities"] });
      } else if (entityType === "software") {
        await restoreSoftware({ id });
        await queryClient.invalidateQueries({ queryKey: ["/api/software"] });
      } else {
        await restoreDocument({ id });
        await queryClient.invalidateQueries({ queryKey: ["/api/documentation"] });
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/deleted-records"] });
    } catch {
    } finally {
      setRestoringId(null);
    }
  };

  const handleTeamDelete = async () => {
    if (!teamDeleteTarget) return;
    try {
      await deleteTeam({ id: teamDeleteTarget.id });
      await queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      setTeamDeleteTarget(null);
    } catch {}
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
    } catch {}
  };

  const openCreate = () => { setEditTarget(null); setForm({ ...EMPTY_FORM }); setErrors({}); setOpen(true); };

  const openEdit = (user: UserRow) => {
    setEditTarget(user);
    setForm({
      name: user.name ?? "",
      email: user.email ?? "",
      role: user.role ?? "viewer",
      phone: user.phone ?? "",
      department: user.department ?? "",
      status: user.status ?? "Active",
      password: "",
    });
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
    const payload: Record<string, unknown> = {
      name: form.name,
      email: form.email,
      role: form.role,
      phone: form.phone || undefined,
      department: form.department || undefined,
      status: form.status,
    };
    if (form.password) payload.password = form.password;
    try {
      if (editTarget) {
        await updateUser({ id: editTarget.id, data: payload as any });
      } else {
        await createUser({ data: payload as any });
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setOpen(false);
      setForm({ ...EMPTY_FORM });
      setErrors({});
      toast({ title: editTarget ? "User updated successfully" : "User account created successfully" });
    } catch (err) {
      const serverMessage = err instanceof ApiError
        ? (err.data as { message?: string } | null)?.message
        : undefined;
      setErrors({ submit: serverMessage ?? `Failed to ${editTarget ? "update" : "create"} user.` });
    }
  };

  const renderDeletedSection = (entityType: "applications" | "infrastructure" | "databases" | "domains" | "repositories" | "releases" | "vulnerabilities" | "software" | "documents", items: DeletedEntity[]) => {
    if (items.length === 0) return null;
    const isRestoring = (id: number) => restoringId === `${entityType}:${id}`;
    return (
      <div key={entityType}>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 mt-4">{ENTITY_TYPE_LABELS[entityType]}</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Deleted</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(item => {
              const deletedDate = item.deletedAt ? new Date(item.deletedAt) : null;
              const expiresDate = deletedDate ? new Date(deletedDate.getTime() + 30 * 24 * 60 * 60 * 1000) : null;
              const daysLeft = expiresDate ? Math.ceil((expiresDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{deletedDate ? deletedDate.toLocaleDateString() : "—"}</TableCell>
                  <TableCell>
                    {daysLeft !== null && (
                      <Badge variant={daysLeft <= 5 ? "destructive" : daysLeft <= 10 ? "secondary" : "outline"} className="text-xs">
                        {daysLeft}d remaining
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" className="h-7 text-xs" disabled={isRestoring(item.id)} onClick={() => handleRestore(entityType, item.id)}>
                      {isRestoring(item.id) ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RotateCcw className="h-3 w-3 mr-1" />}
                      Restore
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Administration</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage users, roles, teams, and system audit logs.</p>
        </div>
      </div>

      {/* Role legend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ROLE_OPTIONS.map(role => (
          <div key={role} className={`rounded-lg border px-3 py-2.5 ${ROLE_BADGE[role] ?? ""}`}>
            <p className="text-xs font-semibold mb-0.5">{ROLE_LABELS[role] ?? role}</p>
            <p className="text-[10px] leading-snug opacity-80">{ROLE_DESCRIPTIONS[role]}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList>
          <TabsTrigger value="users">Users & Roles</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="deleted">
            Recently Deleted
            {totalDeleted > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{totalDeleted}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Manage user access, roles, and login credentials.</CardDescription>
              </div>
              {canAdmin && <Button onClick={openCreate} size="sm"><Plus className="h-4 w-4 mr-2" />New User</Button>}
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : users && users.length > 0 ? (
                <div className="overflow-x-auto -mx-6">
                  <Table className="min-w-[800px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Password</TableHead>
                        <TableHead>Last Login</TableHead>
                        {canAdmin && <TableHead className="w-16"></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedUsers.map((user) => {
                        const u = user as UserRow;
                        return (
                          <TableRow key={u.id}>
                            <TableCell className="font-medium">{u.name}</TableCell>
                            <TableCell className="text-sm">{u.email}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{u.phone || '—'}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold capitalize ${ROLE_BADGE[u.role] ?? ""}`}>
                                {ROLE_LABELS[u.role] ?? u.role}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{u.department || '—'}</TableCell>
                            <TableCell>
                              <Badge variant={u.status === 'Active' || u.status === 'active' ? 'default' : 'secondary'} className="capitalize text-[10px]">{u.status}</Badge>
                            </TableCell>
                            <TableCell>
                              {u.hasPassword ? (
                                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600">
                                  <CheckCircle2 className="h-3 w-3" />Set
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] text-amber-600">
                                  <KeyRound className="h-3 w-3" />Not set
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}</TableCell>
                            {canAdmin && (
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(u)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-sm text-muted-foreground mb-4">No users found.</p>
                  {canAdmin && <Button variant="outline" onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add First User</Button>}
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
              {canAdmin && <Button onClick={openTeamCreate} size="sm"><Plus className="h-4 w-4 mr-2" />New Team</Button>}
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
                        {canAdmin && <TableHead className="w-16"></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teams.map((team) => (
                        <TableRow key={team.id}>
                          <TableCell className="font-medium">{team.name}</TableCell>
                          <TableCell><Badge variant="outline" className="font-mono text-xs">{team.slug}</Badge></TableCell>
                          <TableCell className="text-muted-foreground text-sm">{(team as TeamRow).description || '—'}</TableCell>
                          {canAdmin && (
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
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-sm text-muted-foreground mb-4">No teams found.</p>
                  {canAdmin && <Button variant="outline" onClick={openTeamCreate}><Plus className="h-4 w-4 mr-2" />Add First Team</Button>}
                </div>
              )}
              <TablePagination page={teamsPage} totalPages={teamsTotalPages} onPageChange={setTeamsPage} startIndex={teamsStartIndex} endIndex={teamsEndIndex} total={teamsTotal} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deleted" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Recently Deleted</CardTitle>
              <CardDescription>Records deleted in the last 30 days across all modules. Permanently removed after 30 days.</CardDescription>
            </CardHeader>
            <CardContent>
              {deletedLoading ? (
                <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : totalDeleted === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-muted-foreground">No recently deleted records.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {renderDeletedSection("applications", (deletedRecords?.applications ?? []) as DeletedEntity[])}
                  {renderDeletedSection("infrastructure", (deletedRecords?.infrastructure ?? []) as DeletedEntity[])}
                  {renderDeletedSection("databases", (deletedRecords?.databases ?? []) as DeletedEntity[])}
                  {renderDeletedSection("domains", (deletedRecords?.domains ?? []) as DeletedEntity[])}
                  {renderDeletedSection("repositories", (deletedRecords?.repositories ?? []) as DeletedEntity[])}
                  {renderDeletedSection("releases", (deletedRecords?.releases ?? []).map(r => ({ id: r.id, name: `v${(r as any).version}`, deletedAt: r.deletedAt })) as DeletedEntity[])}
                  {renderDeletedSection("vulnerabilities", (deletedRecords?.vulnerabilities ?? []).map(v => ({ id: v.id, name: v.title, deletedAt: v.deletedAt })) as DeletedEntity[])}
                  {renderDeletedSection("software", (deletedRecords?.software ?? []).map(s => ({ id: s.id, name: s.name, deletedAt: s.deletedAt })) as DeletedEntity[])}
                  {renderDeletedSection("documents", (deletedRecords?.documents ?? []).map(d => ({ id: d.id, name: d.title, deletedAt: d.deletedAt })) as DeletedEntity[])}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>System Audit Logs</CardTitle>
              <CardDescription>Recent activity across all system modules.</CardDescription>
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
                      {auditLogs.map((log) => (
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

      {/* User create/edit dialog */}
      {canAdmin && (
        <Dialog open={open} onOpenChange={(v) => { if (!isPending) { setOpen(v); if (!v) { setForm({ ...EMPTY_FORM }); setErrors({}); } } }}>
          <DialogContent className="max-w-md p-0 gap-0 max-h-[90vh] overflow-y-auto">
            <DialogHeader className="px-6 pt-6 pb-4 border-b">
              <DialogTitle>{editTarget ? "Edit User" : "Add User"}</DialogTitle>
            </DialogHeader>
            <div className="px-6 py-5 space-y-4">
              {errors.submit && <div className="text-sm text-destructive bg-destructive/10 px-4 py-2 rounded-md">{errors.submit}</div>}
              <Field label="Full Name" required error={errors.name}>
                <Input placeholder="John Smith" value={form.name} onChange={set("name")} className="h-9" />
              </Field>
              <Field label="Email" required error={errors.email}>
                <Input type="email" placeholder="john.smith@mk.gov" value={form.email} onChange={set("email")} className="h-9" />
              </Field>
              <Field label="Phone" error={errors.phone}>
                <Input type="tel" placeholder="+252 61 234 5678" value={form.phone} onChange={set("phone")} className="h-9" />
              </Field>
              <RoleSelectField
                value={form.role}
                onChange={(role) => setForm(f => ({ ...f, role }))}
                error={errors.role}
              />
              <div className="grid grid-cols-2 gap-4">
                <Field label="Status">
                  <SelectField value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))} placeholder="Select status" options={STATUS_OPTIONS} />
                </Field>
                <Field label="Department">
                  <Input placeholder="Platform Team" value={form.department} onChange={set("department")} className="h-9" />
                </Field>
              </div>
              <Field
                label={editTarget ? "New Password" : "Password"}
                hint={editTarget ? "Leave blank to keep the existing password" : "Required — user will use this to log in"}
                error={errors.password}
              >
                <PasswordInput
                  value={form.password}
                  onChange={(v) => setForm(f => ({ ...f, password: v }))}
                  onGenerate={() => setForm(f => ({ ...f, password: generatePassword() }))}
                  placeholder={editTarget ? "Leave blank to keep unchanged" : "Set login password"}
                />
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
      )}

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
        entityName="user"
        itemLabel={deleteTarget?.name ?? ""}
        isPending={isDeleting}
        onConfirm={handleDelete}
      />

      {canAdmin && (
        <Dialog open={teamOpen} onOpenChange={(v) => { if (!isTeamPending) { setTeamOpen(v); if (!v) { setTeamForm({ ...EMPTY_TEAM_FORM }); setTeamErrors({}); } } }}>
          <DialogContent className="max-w-md p-0 gap-0">
            <DialogHeader className="px-6 pt-6 pb-4 border-b">
              <DialogTitle>{teamEditTarget ? "Edit Team" : "Add Team"}</DialogTitle>
            </DialogHeader>
            <div className="px-6 py-5 space-y-4">
              {teamErrors.submit && <div className="text-sm text-destructive bg-destructive/10 px-4 py-2 rounded-md">{teamErrors.submit}</div>}
              <Field label="Team Name" required error={teamErrors.name}>
                <Input placeholder="Infrastructure & Cloud Operations" value={teamForm.name} onChange={setTeam("name")} className="h-9" />
              </Field>
              <Field label="Slug" required error={teamErrors.slug}>
                <Input placeholder="infra-cloud-ops" value={teamForm.slug} onChange={setTeam("slug")} className="h-9" />
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
      )}

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
