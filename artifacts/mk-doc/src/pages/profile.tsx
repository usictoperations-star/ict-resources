import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth";
import { useUpdateUser, useListAuditLogs } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { User, Lock, Activity, Mail, Phone, Building2, ShieldCheck, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";

const ACTION_COLOR: Record<string, string> = {
  CREATE: "bg-emerald-500/15 text-emerald-700 border-emerald-300",
  UPDATE: "bg-blue-500/15 text-blue-700 border-blue-300",
  DELETE: "bg-red-500/15 text-red-700 border-red-300",
};

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const letters = parts.length >= 2
    ? parts[0][0] + parts[parts.length - 1][0]
    : name.slice(0, 2);
  return (
    <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white text-2xl font-bold select-none shadow-lg">
      {letters.toUpperCase()}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const updateUser = useUpdateUser();

  const [profile, setProfile] = useState({ name: "", phone: "", department: "" });
  const [profileDirty, setProfileDirty] = useState(false);
  const [pw, setPw] = useState({ newPassword: "", confirm: "" });
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});

  const { data: allLogsPage } = useListAuditLogs({ limit: 200 });
  const myLogs = (allLogsPage?.data ?? [])
    .filter(l => l.userName === user?.name)
    .slice(0, 20);

  useEffect(() => {
    if (user) {
      setProfile({
        name: user.name ?? "",
        phone: (user as any).phone ?? "",
        department: (user as any).department ?? "",
      });
    }
  }, [user]);

  function setP(k: keyof typeof profile) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setProfile(prev => ({ ...prev, [k]: e.target.value }));
      setProfileDirty(true);
    };
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!profile.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    updateUser.mutate(
      {
        id: user.id,
        data: {
          name: profile.name.trim(),
          phone: profile.phone || undefined,
          department: profile.department || undefined,
        },
      },
      {
        onSuccess: () => {
          setProfileDirty(false);
          toast({ title: "Profile updated" });
        },
        onError: () => toast({ title: "Failed to update profile", variant: "destructive" }),
      }
    );
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!pw.newPassword) errs.newPassword = "Enter a new password";
    else if (pw.newPassword.length < 8) errs.newPassword = "At least 8 characters";
    if (pw.newPassword !== pw.confirm) errs.confirm = "Passwords do not match";
    if (Object.keys(errs).length) { setPwErrors(errs); return; }
    setPwErrors({});
    if (!user) return;
    updateUser.mutate(
      { id: user.id, data: { password: pw.newPassword } as any },
      {
        onSuccess: () => {
          setPw({ newPassword: "", confirm: "" });
          toast({ title: "Password changed" });
        },
        onError: () => toast({ title: "Failed to change password", variant: "destructive" }),
      }
    );
  }

  const roleBadge = user?.roles?.[0] ?? "viewer";

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your account details and preferences.</p>
      </div>

      {/* Identity card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-5">
            <Initials name={user?.name ?? "?"} />
            <div className="space-y-1">
              <p className="text-xl font-semibold leading-tight">{user?.name}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> {user?.email}
              </p>
              {(user as any)?.department && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" /> {(user as any).department}
                </p>
              )}
              <div className="pt-1">
                <Badge variant="outline" className="text-xs capitalize flex items-center gap-1 w-fit">
                  <ShieldCheck className="h-3 w-3" />
                  {roleBadge}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit profile */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" /> Personal Information
          </CardTitle>
          <CardDescription>Update your name, phone, and department. Email cannot be changed.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full Name">
                <Input value={profile.name} onChange={setP("name")} placeholder="Your full name" className="h-9" />
              </Field>
              <Field label="Email">
                <div className="relative">
                  <Input value={user?.email ?? ""} readOnly disabled className="h-9 bg-muted/50 cursor-not-allowed pr-20" />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    Company email
                  </span>
                </div>
              </Field>
              <Field label="Phone">
                <Input
                  value={profile.phone}
                  onChange={setP("phone")}
                  placeholder="+60 12-345 6789"
                  className="h-9"
                  type="tel"
                />
              </Field>
              <Field label="Department">
                <Input value={profile.department} onChange={setP("department")} placeholder="Platform Team" className="h-9" />
              </Field>
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={!profileDirty || updateUser.isPending}>
                {updateUser.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Change password */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" /> Change Password
          </CardTitle>
          <CardDescription>Choose a strong password of at least 8 characters.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={savePassword} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="New Password">
                <Input
                  type="password"
                  value={pw.newPassword}
                  onChange={e => { setPw(p => ({ ...p, newPassword: e.target.value })); setPwErrors({}); }}
                  placeholder="••••••••"
                  className="h-9"
                />
                {pwErrors.newPassword && <p className="text-xs text-destructive mt-1">{pwErrors.newPassword}</p>}
              </Field>
              <Field label="Confirm New Password">
                <Input
                  type="password"
                  value={pw.confirm}
                  onChange={e => { setPw(p => ({ ...p, confirm: e.target.value })); setPwErrors({}); }}
                  placeholder="••••••••"
                  className="h-9"
                />
                {pwErrors.confirm && <p className="text-xs text-destructive mt-1">{pwErrors.confirm}</p>}
              </Field>
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="sm" variant="outline" disabled={updateUser.isPending}>
                {updateUser.isPending ? "Updating…" : "Update Password"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* My activity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" /> My Recent Activity
          </CardTitle>
          <CardDescription>Your last {myLogs.length} actions in the system.</CardDescription>
        </CardHeader>
        <CardContent>
          {myLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No activity recorded yet.</p>
          ) : (
            <div className="space-y-0">
              {myLogs.map((log, i) => (
                <div key={log.id}>
                  {i > 0 && <Separator />}
                  <div className="flex items-start gap-3 py-3">
                    <div className={`mt-0.5 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ACTION_COLOR[log.action] ?? "bg-gray-100 text-gray-700 border-gray-300"}`}>
                      {log.action}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {log.entityType}
                        {log.entityName && <span className="text-muted-foreground font-normal"> — {log.entityName}</span>}
                      </p>
                      {log.changes && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{log.changes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                      <Clock className="h-3 w-3" />
                      {format(parseISO(log.createdAt), "dd MMM, HH:mm")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
