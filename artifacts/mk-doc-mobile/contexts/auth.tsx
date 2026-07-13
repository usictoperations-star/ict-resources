import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import { setCookieGetter } from "@workspace/api-client-react";

const COOKIE_KEY = "mk_doc_session_cookie";
const BIOMETRIC_KEY = "mk_biometric_enabled";

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
  needsBiometricUnlock: boolean;
  isBiometricEnabled: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  unlockBiometric: () => void;
  enableBiometric: () => Promise<void>;
  disableBiometric: () => Promise<void>;
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

async function getBiometricPref(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const val = await SecureStore.getItemAsync(BIOMETRIC_KEY);
    return val === "1";
  } catch {
    return false;
  }
}

function parseCookieFromHeader(header: string): string | null {
  const part = header.split(";")[0].trim();
  return part || null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsBiometricUnlock, setNeedsBiometricUnlock] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const pendingUserRef = useRef<AuthUser | null>(null);

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
          const biometricOn = await getBiometricPref();
          setIsBiometricEnabled(biometricOn);
          if (biometricOn && Platform.OS !== "web") {
            pendingUserRef.current = data;
            setNeedsBiometricUnlock(true);
          } else {
            setUser(data);
          }
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

    setNeedsBiometricUnlock(false);
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
    pendingUserRef.current = null;
    setNeedsBiometricUnlock(false);
    setUser(null);
  }, []);

  const unlockBiometric = useCallback(() => {
    if (pendingUserRef.current) {
      setUser(pendingUserRef.current);
      pendingUserRef.current = null;
      setNeedsBiometricUnlock(false);
    }
  }, []);

  const enableBiometric = useCallback(async () => {
    if (Platform.OS === "web") return;
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!compatible || !enrolled) {
        throw new Error("Biometric authentication is not available on this device.");
      }
      await SecureStore.setItemAsync(BIOMETRIC_KEY, "1");
      setIsBiometricEnabled(true);
    } catch (err) {
      throw err;
    }
  }, []);

  const disableBiometric = useCallback(async () => {
    if (Platform.OS === "web") return;
    try {
      await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
      setIsBiometricEnabled(false);
    } catch {
      // ignore
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      needsBiometricUnlock,
      isBiometricEnabled,
      login,
      logout,
      unlockBiometric,
      enableBiometric,
      disableBiometric,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
