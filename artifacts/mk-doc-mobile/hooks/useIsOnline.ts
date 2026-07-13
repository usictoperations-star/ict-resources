import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export function useIsOnline() {
  const [isOnline, setIsOnline] = useState(true);

  const checkConnectivity = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/healthz`, {
        method: "HEAD",
        signal: AbortSignal.timeout(5000),
      });
      setIsOnline(res.ok || res.status < 500);
    } catch {
      setIsOnline(false);
    }
  }, []);

  useEffect(() => {
    void checkConnectivity();
    const interval = setInterval(() => void checkConnectivity(), 30_000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void checkConnectivity();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [checkConnectivity]);

  return isOnline;
}
