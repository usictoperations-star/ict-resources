import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { registerPushToken } from "@workspace/api-client-react";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

type PermCheck = { granted: boolean };

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const perms = (await Notifications.getPermissionsAsync()) as unknown as PermCheck;
  if (perms.granted) return true;
  const result = (await Notifications.requestPermissionsAsync()) as unknown as PermCheck;
  return result.granted;
}

/**
 * After permission is granted, retrieve this device's Expo push token and
 * register it with the MK DOC API server. The server uses the stored tokens
 * to fan out push notifications when a domain crosses into critical/expired.
 */
export async function registerDevicePushToken(): Promise<void> {
  if (Platform.OS === "web") return;

  const perms = (await Notifications.getPermissionsAsync()) as unknown as PermCheck;
  if (!perms.granted) return;

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    if (!token.startsWith("ExponentPushToken[")) return;

    await registerPushToken({ token });
  } catch {
    // Token registration is best-effort; don't crash the app
  }
}

/**
 * Wire up the notification tap → deep-link handler. Call this once from the
 * root layout so the listener spans the full app lifetime.
 */
export function useNotificationDeepLink(): void {
  const router = useRouter();
  const listenerRef = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (Platform.OS === "web") return;

    function navigate(data: Record<string, unknown> | null | undefined): void {
      const filter = data?.filter as string | undefined;
      if (filter === "expired" || filter === "critical") {
        router.push(`/(tabs)/domains?filter=${filter}` as never);
      } else {
        router.push("/(tabs)/domains" as never);
      }
    }

    // Notification tapped while app is open or resuming from background
    listenerRef.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        navigate(response.notification.request.content.data);
      }
    );

    // Notification that cold-started the app from killed state
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!response) return;
        navigate(response.notification.request.content.data);
      })
      .catch(() => {});

    return () => {
      listenerRef.current?.remove();
    };
  }, [router]);
}
