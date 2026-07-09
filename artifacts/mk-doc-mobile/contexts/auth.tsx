import * as SecureStore from "expo-secure-store";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";

import { setCookieGetter } from "@workspace/api-client-react";

const COOKIE_KEY = "mk_doc_session_cookie";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  department?: string | null;
  phone?: string | null;
  status: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function restoreCookie(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    return await SecureStore.getItemAsync(COOKIE_KEY);
  } catch {
    return null;
  }
}

async function saveCookie(value: string): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await SecureStore.setItemAsync(COOKIE_KEY, value);
  } catch {
    // ignore
  }
}

async function clearCookie(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await SecureStore.deleteItemAsync(COOKIE_KEY);
  } catch {
    // ignore
  }
}

function parseCookieFromHeader(header: string): string | null {
  const part = header.split(";")[0].trim();
  return part || null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function initAuth() {
      try {
        const stored = await restoreCookie();
        if (stored && Platform.OS !== "web") {
          setCookieGetter(() => stored);
        }

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (stored && Platform.OS !== "web") {
          headers["Cookie"] = stored;
        }

        const res = await fetch(`${BASE_URL}/api/auth/me`, { headers });
        if (res.ok) {
          const data = await res.json();
          setUser(data);
        } else {
          await clearCookie();
          if (Platform.OS !== "web") {
            setCookieGetter(null);
          }
        }
      } catch {
        // Network error or no session
      } finally {
        setIsLoading(false);
      }
    }

    void initAuth();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      let message = "Login failed";
      try {
        const data = await res.json();
        if (typeof data?.error === "string") message = data.error;
      } catch {
        // ignore parse errors
      }
      throw new Error(message);
    }

    const userData: AuthUser = await res.json();

    if (Platform.OS !== "web") {
      const setCookieHeader = res.headers.get("set-cookie");
      if (setCookieHeader) {
        const cookieValue = parseCookieFromHeader(setCookieHeader);
        if (cookieValue) {
          await saveCookie(cookieValue);
          setCookieGetter(() => cookieValue);
        }
      }
    }

    setUser(userData);
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      const headers: Record<string, string> = {};
      if (Platform.OS !== "web") {
        const stored = await restoreCookie();
        if (stored) headers["Cookie"] = stored;
      }
      await fetch(`${BASE_URL}/api/auth/logout`, { method: "POST", headers });
    } catch {
      // ignore
    }

    await clearCookie();
    if (Platform.OS !== "web") {
      setCookieGetter(null);
    }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
