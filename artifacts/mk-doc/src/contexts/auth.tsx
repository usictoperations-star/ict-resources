import React, { createContext, useContext, useEffect, useState } from "react";

export type Role = "admin" | "editor" | "analyst" | "viewer";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  roles: Role[];
  phone?: string | null;
  department?: string | null;
  status: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (action: "write" | "delete" | "admin" | "reports") => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const ROLE_RANK: Record<Role, number> = {
  admin: 4,
  editor: 3,
  analyst: 2,
  viewer: 1,
};

function roleCanDo(role: Role, action: "write" | "delete" | "admin" | "reports"): boolean {
  switch (action) {
    case "admin":   return role === "admin";
    case "delete":  return role === "admin";
    case "write":   return ROLE_RANK[role] >= ROLE_RANK["editor"];
    case "reports": return ROLE_RANK[role] >= ROLE_RANK["analyst"];
    default:        return false;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/api/auth/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setUser(data ?? null))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Login failed");
    }
    const data = await res.json();
    setUser(data);
  };

  const logout = async () => {
    await fetch(`${BASE}/api/auth/logout`, { method: "POST", credentials: "include" });
    setUser(null);
  };

  const can = (action: "write" | "delete" | "admin" | "reports") =>
    user ? user.roles.some(r => roleCanDo(r as Role, action)) : false;

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
